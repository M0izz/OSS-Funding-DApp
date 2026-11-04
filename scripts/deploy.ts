import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Deploy OSSFundingSplitter to the configured network.
 *
 * Ananya's split (10 recipients, 10 000 basis points total):
 *   Maintainer (Ananya)   2500 bp  25 %
 *   Upstream lib 1        1000 bp  10 %
 *   Upstream lib 2        1000 bp  10 %
 *   Upstream lib 3        1000 bp  10 %
 *   Contributor 1          700 bp   7 %
 *   Contributor 2          700 bp   7 %
 *   Contributor 3          700 bp   7 %
 *   Contributor 4          700 bp   7 %
 *   Contributor 5          700 bp   7 %
 *   Sponsor reserve       1000 bp  10 %
 *
 * Edit the RECIPIENTS array below with real addresses before deploying.
 */

// ─── EDIT THESE ADDRESSES ────────────────────────────────────────────────────
const RECIPIENTS: string[] = [
    "0xYourMaintainerAddressHere",   // Ananya (maintainer)       25 %
    "0xYourUpstream1AddressHere",    // Upstream lib 1            10 %
    "0xYourUpstream2AddressHere",    // Upstream lib 2            10 %
    "0xYourUpstream3AddressHere",    // Upstream lib 3            10 %
    "0xYourContributor1AddressHere", // Contributor 1              7 %
    "0xYourContributor2AddressHere", // Contributor 2              7 %
    "0xYourContributor3AddressHere", // Contributor 3              7 %
    "0xYourContributor4AddressHere", // Contributor 4              7 %
    "0xYourContributor5AddressHere", // Contributor 5              7 %
    "0xYourSponsorReserveAddressHere", // Sponsor transparency reserve 10 %
];

const SHARES: bigint[] = [
    2500n, // 25 %
    1000n, // 10 %
    1000n, // 10 %
    1000n, // 10 %
    700n, //  7 %
    700n, //  7 %
    700n, //  7 %
    700n, //  7 %
    700n, //  7 %
    1000n, // 10 %
]; // sum = 10 000

async function main() {
    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();
    console.log(`Network: ${network.name} (chainId ${network.chainId})`);
    console.log(`Deployer: ${deployer.address}`);
    console.log(`Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);

    console.log("\nDeploying OSSFundingSplitter...");
    const Factory = await ethers.getContractFactory("OSSFundingSplitter");
    const splitter = await Factory.deploy(RECIPIENTS, SHARES);
    await splitter.waitForDeployment();
    const address = await splitter.getAddress();
    console.log(`OSSFundingSplitter deployed to: ${address}`);

    // Save deployment info
    const deploymentDir = path.join(__dirname, "..", "deployments");
    if (!fs.existsSync(deploymentDir)) {
        fs.mkdirSync(deploymentDir, { recursive: true });
    }
    const deploymentFile = path.join(deploymentDir, `${network.name}.json`);
    const info = {
        address,
        network: network.name,
        chainId: network.chainId.toString(),
        deployer: deployer.address,
        deployedAt: new Date().toISOString(),
        recipients: RECIPIENTS,
        shares: SHARES.map((s) => s.toString()),
    };
    fs.writeFileSync(deploymentFile, JSON.stringify(info, null, 2));
    console.log(`Deployment info saved to ${deploymentFile}`);

    console.log("\nVerify on Etherscan:");
    console.log(
        `  npx hardhat verify --network ${network.name} ${address} '[${RECIPIENTS.map((r) => `"${r}"`).join(",")}]' '[${SHARES.join(",")}]'`
    );
}

main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
});
