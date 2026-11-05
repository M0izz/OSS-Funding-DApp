import { expect } from "chai";
import { ethers } from "hardhat";
import { OSSFundingSplitter, ReentrancyAttacker } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const BP = 10_000n; // BASIS_POINTS

/** Deploy the splitter with a simple 2-recipient split. */
async function deploySplitter(
    recipients: string[],
    shares: bigint[]
): Promise<OSSFundingSplitter> {
    const Factory = await ethers.getContractFactory("OSSFundingSplitter");
    const contract = await Factory.deploy(recipients, shares);
    await contract.waitForDeployment();
    return contract as unknown as OSSFundingSplitter;
}

/** Standard Ananya-like split for most tests. */
async function deployDefault(
    signers: SignerWithAddress[]
): Promise<OSSFundingSplitter> {
    const recipients = [
        signers[1].address, // maintainer  25 %
        signers[2].address, // upstream 1  10 %
        signers[3].address, // upstream 2  10 %
        signers[4].address, // upstream 3  10 %
        signers[5].address, // contrib 1    7 %
    ];
    const shares = [2500n, 1000n, 1000n, 1000n, 1000n]; // total = 6500 — bad!
    // Fix to 100 %:
    const fixedShares = [2500n, 1000n, 1000n, 1000n, 5500n]; // last gets rest
    // Actually set a clean 5-way split summing to 10000:
    const cleanShares = [3000n, 2000n, 2000n, 2000n, 1000n];
    return deploySplitter(recipients, cleanShares);
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────────────────────

describe("OSSFundingSplitter", function () {
    let owner: SignerWithAddress;
    let alice: SignerWithAddress; // maintainer / first recipient
    let bob: SignerWithAddress;
    let carol: SignerWithAddress;
    let dave: SignerWithAddress;
    let sponsor: SignerWithAddress;
    let splitter: OSSFundingSplitter;

    beforeEach(async function () {
        [owner, alice, bob, carol, dave, sponsor] = await ethers.getSigners();

        // 2-recipient split: alice 60 %, bob 40 %
        splitter = await deploySplitter(
            [alice.address, bob.address],
            [6000n, 4000n]
        );
    });

    // ───────────────────────────────────────────────────────────────────────────
    // TC-1: Recipients pull their own payouts
    // ───────────────────────────────────────────────────────────────────────────
    describe("TC-1: Pull-payment — funds are credited and can be withdrawn by recipient", function () {
        it("credits balances on receive() and lets the recipient pull via withdraw()", async function () {
            const ONE_ETH = ethers.parseEther("1");

            // Sponsor sends ETH via the receive() fallback
            await sponsor.sendTransaction({ to: await splitter.getAddress(), value: ONE_ETH });

            // Balances credited: alice 60 %, bob 40 %
            const aliceBalance = await splitter.balances(alice.address);
            const bobBalance = await splitter.balances(bob.address);

            expect(aliceBalance).to.equal((ONE_ETH * 6000n) / BP);
            expect(bobBalance).to.equal((ONE_ETH * 4000n) / BP);

            // Alice pulls her own funds — balance must clear to zero
            await splitter.connect(alice).withdraw();
            expect(await splitter.balances(alice.address)).to.equal(0n);

            // Bob pulls his own funds
            await splitter.connect(bob).withdraw();
            expect(await splitter.balances(bob.address)).to.equal(0n);
        });

        it("withdraw() sends ETH only to msg.sender, not to others", async function () {
            const fundAmount = ethers.parseEther("2");
            await splitter.fund({ value: fundAmount });

            const aliceBefore = await ethers.provider.getBalance(alice.address);
            const tx = await splitter.connect(alice).withdraw();
            const receipt = await tx.wait();
            const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
            const aliceAfter = await ethers.provider.getBalance(alice.address);

            const expected = (fundAmount * 6000n) / BP;
            expect(aliceAfter - aliceBefore + gasUsed).to.equal(expected);
        });
    });

    // ───────────────────────────────────────────────────────────────────────────
    // TC-2: No privileged function can drain recipient balances
    // ───────────────────────────────────────────────────────────────────────────
    describe("TC-2: No owner drain — credited balances cannot be moved by the owner", function () {
        it("owner has no function that transfers credited balances to another address", async function () {
            // Fund the contract
            await splitter.fund({ value: ethers.parseEther("1") });

            const aliceCredited = await splitter.balances(alice.address);
            expect(aliceCredited).to.be.gt(0n);

            // setSplit only changes future distributions — does NOT move credited funds
            await splitter
                .connect(owner)
                .setSplit([alice.address, carol.address], [5000n, 5000n]);

            // Alice's existing credit is untouched
            expect(await splitter.balances(alice.address)).to.equal(aliceCredited);

            // Owner cannot call withdraw() on behalf of alice
            await expect(
                splitter.connect(owner).withdraw()
            ).to.be.revertedWith("OSSFundingSplitter: nothing to withdraw");

            // Contract has no selfdestruct, sweep, or emergencyWithdraw function
            // (compile-time guarantee — we just confirm the ABI lacks them)
            const dangerousFns: string[] = [];
            splitter.interface.forEachFunction((fn) => {
                const name = fn.name.toLowerCase();
                if (
                    ["sweep", "drain", "emergencywithdraw", "rescuefunds"].some((bad) =>
                        name.includes(bad)
                    )
                ) {
                    dangerousFns.push(fn.name);
                }
            });
            expect(dangerousFns).to.have.length(0);
        });
    });

    // ───────────────────────────────────────────────────────────────────────────
    // TC-3: Withdrawal clears balance before external call (CEI + ReentrancyGuard)
    // ───────────────────────────────────────────────────────────────────────────
    describe("TC-3: Reentrancy protection — balance zeroed before transfer", function () {
        it("ReentrancyAttacker cannot drain more than its share via re-entry", async function () {
            const AttackerFactory = await ethers.getContractFactory("ReentrancyAttacker");
            const singleSplitter = await deploySplitter(
                [alice.address, bob.address],
                [5000n, 5000n]
            );
            const attacker = (await AttackerFactory.deploy(
                await singleSplitter.getAddress()
            )) as unknown as ReentrancyAttacker;

            await singleSplitter
                .connect(owner)
                .setSplit([await attacker.getAddress(), alice.address], [5000n, 5000n]);

            // The remaining half-share keeps the splitter funded during receive(),
            // so the attacker reaches the nested withdrawal attempt.
            await attacker.attack({ value: ethers.parseEther("1") });

            const attackerBalance = await attacker.getBalance();
            const splitterBalance = await ethers.provider.getBalance(await singleSplitter.getAddress());

            expect(await attacker.attackCount()).to.equal(1n);
            expect(await attacker.reentryAttempted()).to.equal(true);
            expect(await attacker.reentryBlocked()).to.equal(true);
            expect(await attacker.reentryErrorSelector()).to.equal(
                ethers.id("ReentrancyGuardReentrantCall()").slice(0, 10)
            );
            expect(attackerBalance).to.equal(ethers.parseEther("0.5"));
            expect(splitterBalance).to.equal(ethers.parseEther("0.5"));
            expect(await singleSplitter.balances(await attacker.getAddress())).to.equal(0n);
            expect(await singleSplitter.balances(alice.address)).to.equal(ethers.parseEther("0.5"));
        });
    });

    // ───────────────────────────────────────────────────────────────────────────
    // TC-4: Split shares validated to sum to declared total
    // ───────────────────────────────────────────────────────────────────────────
    describe("TC-4: Split validation — shares must sum to BASIS_POINTS", function () {
        it("reverts in constructor when shares do not sum to 10 000", async function () {
            const Factory = await ethers.getContractFactory("OSSFundingSplitter");
            await expect(
                Factory.deploy([alice.address, bob.address], [5000n, 4999n])
            ).to.be.revertedWith("OSSFundingSplitter: shares must sum to BASIS_POINTS");
        });

        it("reverts in setSplit when shares do not sum to 10 000", async function () {
            await expect(
                splitter.connect(owner).setSplit([alice.address, bob.address], [3000n, 3000n])
            ).to.be.revertedWith("OSSFundingSplitter: shares must sum to BASIS_POINTS");
        });

        it("reverts when arrays have different lengths", async function () {
            await expect(
                splitter.connect(owner).setSplit([alice.address], [5000n, 5000n])
            ).to.be.revertedWith("OSSFundingSplitter: length mismatch");
        });

        it("accepts a valid split that sums to exactly 10 000", async function () {
            await expect(
                splitter.connect(owner).setSplit([alice.address, bob.address], [7777n, 2223n])
            ).to.emit(splitter, "SplitUpdated");
        });

        it("reverts when a recipient is the zero address", async function () {
            await expect(
                splitter
                    .connect(owner)
                    .setSplit([ethers.ZeroAddress, bob.address], [5000n, 5000n])
            ).to.be.revertedWith("OSSFundingSplitter: zero address recipient");
        });
    });

    // ───────────────────────────────────────────────────────────────────────────
    // TC-5: Rounding remainders assigned, not stranded
    // ───────────────────────────────────────────────────────────────────────────
    describe("TC-5: Remainder handling — every wei is credited to someone", function () {
        it("sums all credited balances to exactly msg.value even for indivisible amounts", async function () {
            // 3 recipients each with 1/3 share; BASIS_POINTS is not divisible by 3
            // so every amount will produce a remainder.
            const thirdSplitter = await deploySplitter(
                [alice.address, bob.address, carol.address],
                [3334n, 3333n, 3333n] // sums to 10000; first gets rounding benefit
            );

            // Use an amount that will definitely produce remainders: 1 wei to 10003 wei
            const ODD_AMOUNT = 10_003n; // not divisible by 3

            await sponsor.sendTransaction({
                to: await thirdSplitter.getAddress(),
                value: ODD_AMOUNT,
            });

            const aliceBal = await thirdSplitter.balances(alice.address);
            const bobBal = await thirdSplitter.balances(bob.address);
            const carolBal = await thirdSplitter.balances(carol.address);
            const contractBal = await ethers.provider.getBalance(await thirdSplitter.getAddress());

            // Sum of credited balances must equal exactly the amount sent
            expect(aliceBal + bobBal + carolBal).to.equal(ODD_AMOUNT);
            // Contract holds exactly the credited amount (= sent amount)
            expect(contractBal).to.equal(ODD_AMOUNT);
        });
    });

    // ───────────────────────────────────────────────────────────────────────────
    // TC-6: Credited amount comes from msg.value, not a caller-supplied argument
    // ───────────────────────────────────────────────────────────────────────────
    describe("TC-6: Accounting correctness — credited amount equals msg.value", function () {
        it("total credited balances equal the exact ETH sent (via receive)", async function () {
            const amount = ethers.parseEther("3");
            await sponsor.sendTransaction({ to: await splitter.getAddress(), value: amount });

            const total =
                (await splitter.balances(alice.address)) +
                (await splitter.balances(bob.address));
            expect(total).to.equal(amount);
        });

        it("total credited balances equal the exact ETH sent (via fund())", async function () {
            const amount = ethers.parseEther("0.5");
            await splitter.connect(sponsor).fund({ value: amount });

            const total =
                (await splitter.balances(alice.address)) +
                (await splitter.balances(bob.address));
            expect(total).to.equal(amount);
        });
    });

    // ───────────────────────────────────────────────────────────────────────────
    // TC-8: A test asserts a recipient's withdrawn amount
    // ───────────────────────────────────────────────────────────────────────────
    describe("TC-8: Withdrawal amount assertion — exact ETH received", function () {
        it("alice receives exactly her share of the funded ETH after calling withdraw()", async function () {
            const FUND = ethers.parseEther("10");
            // alice share = 60 % of 10 ETH = 6 ETH
            const EXPECTED_ALICE = (FUND * 6000n) / BP;

            await splitter.connect(sponsor).fund({ value: FUND });

            const aliceEthBefore = await ethers.provider.getBalance(alice.address);
            const tx = await splitter.connect(alice).withdraw();
            const receipt = await tx.wait();
            const gasCost = receipt!.gasUsed * receipt!.gasPrice;
            const aliceEthAfter = await ethers.provider.getBalance(alice.address);

            // Net change in alice's ETH balance must equal exactly her credited share
            expect(aliceEthAfter - aliceEthBefore + gasCost).to.equal(EXPECTED_ALICE);
        });

        it("bob receives exactly his share after calling withdraw()", async function () {
            const FUND = ethers.parseEther("5");
            // bob share = 40 % of 5 ETH = 2 ETH
            const EXPECTED_BOB = (FUND * 4000n) / BP;

            await splitter.connect(sponsor).fund({ value: FUND });

            const bobEthBefore = await ethers.provider.getBalance(bob.address);
            const tx = await splitter.connect(bob).withdraw();
            const receipt = await tx.wait();
            const gasCost = receipt!.gasUsed * receipt!.gasPrice;
            const bobEthAfter = await ethers.provider.getBalance(bob.address);

            expect(bobEthAfter - bobEthBefore + gasCost).to.equal(EXPECTED_BOB);
        });

        it("reverts when recipient has nothing to withdraw", async function () {
            await expect(splitter.connect(dave).withdraw()).to.be.revertedWith(
                "OSSFundingSplitter: nothing to withdraw"
            );
        });
    });
});
