# Pay It Upstream – Trustless OSS Funding on Ethereum

> **One address for sponsors. On-chain rules everyone can read. No way for anyone to quietly keep what is owed.**

Live on **Sepolia testnet** → contract address below.

---

## The Problem (Ananya's Story)

Ananya maintains a small date-parsing library that tens of thousands of projects quietly depend on. Two companies sponsor it each month, and the money lands in her personal account. She relies on three upstream libraries and five regular contributors across four countries, and she promised all of them a share.

In practice she pays them by hand, late, losing money to fees each time — and one contributor cannot receive a bank transfer at all. Last month a sponsor asked for *proof* that the money reaches the people doing the work. All she had was screenshots.

**Pay It Upstream** fixes this at the protocol level.

---

## Proposed Split for Ananya's Project

The split is expressed in **basis points** (1 bp = 0.01 %). All shares must sum to exactly **10 000 bp** — enforced on-chain at every configuration change.

| # | Role | Basis Points | Share |
|---|------|:---:|---:|
| 1 | **Maintainer** (Ananya) | 2 500 | **25 %** |
| 2 | Upstream library 1 | 1 000 | 10 % |
| 3 | Upstream library 2 | 1 000 | 10 % |
| 4 | Upstream library 3 | 1 000 | 10 % |
| 5 | Contributor 1 | 700 | 7 % |
| 6 | Contributor 2 | 700 | 7 % |
| 7 | Contributor 3 | 700 | 7 % |
| 8 | Contributor 4 | 700 | 7 % |
| 9 | Contributor 5 | 700 | 7 % |
| 10 | Sponsor transparency reserve | 1 000 | 10 % |
| | **Total** | **10 000** | **100 %** |

*Rationale*: The maintainer takes the largest slice (25 %) because she bears the maintenance burden. Upstream dependencies collectively get 30 % — honouring the OSS social contract. Contributors share 35 % equally. The 10 % reserve funds audits, CI costs, and proof-of-payment tooling that sponsors ask for.

---

## How It Works

```
Sponsor  ──sends ETH──▶  OSSFundingSplitter
                               │
                     splits by basis points
                               │
         ┌─────────────────────┼──────────────────────┐
         ▼                     ▼                      ▼
    balances[alice]      balances[bob]  …    balances[reserve]
         │                     │
    alice.withdraw()     bob.withdraw()   (each pulls their own share)
```

### Design principles

| Principle | Implementation |
|---|---|
| **Pull payments** | Each recipient calls `withdraw()` — no push loop |
| **CEI + ReentrancyGuard** | Balance zeroed *before* ETH transfer; OpenZeppelin guard as belt-and-suspenders |
| **No privileged drain** | Owner can only update the *future* split; already-credited balances are untouchable by anyone except the recipient |
| **Exact accounting** | Integer-division remainder goes to recipient[0] — zero wei stranded |
| **Validated splits** | `setSplit()` reverts unless shares sum exactly to 10 000 bp |

---

## Contracts

```
contracts/
  OSSFundingSplitter.sol   ← core contract
  ReentrancyAttacker.sol   ← test helper (not deployed)
```

### Deployed address (Sepolia)

```
CONTRACT_ADDRESS=0xTODO_ADD_AFTER_DEPLOYMENT
```

> Replace with your deployed address. Verify on [Sepolia Etherscan](https://sepolia.etherscan.io).

---

## Repo Structure

```
pay-it-upstream/
├── contracts/              Solidity contracts
├── scripts/deploy.ts       Hardhat deploy script
├── test/                   TypeScript + ethers.js tests
├── frontend/               Vite + React + wagmi v2 frontend
│   └── src/
│       ├── contract.ts     ABI + address (from env)
│       ├── wagmi.ts        Wagmi config (Sepolia + local HH)
│       ├── components/
│       │   ├── SplitView.tsx   reads split from chain
│       │   ├── BalancePanel.tsx reads & withdraws balance
│       │   ├── FundPanel.tsx   sponsor send ETH
│       │   └── ContractInfo.tsx metadata strip
│       └── App.tsx
├── .env.example            required env vars (no real keys)
├── hardhat.config.ts
└── README.md
```

---

## Quick Start

### Prerequisites
- Node ≥ 20
- MetaMask with Sepolia ETH ([faucet](https://sepoliafaucet.com/))

### 1 — Clone & install

```bash
git clone https://github.com/YOUR_USERNAME/OSS-Funding-DApp.git
cd OSS-Funding-DApp
npm install
```

### 2 — Run tests

```bash
npx hardhat test
```

All 15 test cases should pass (covering all 8 scored on-chain criteria).

### 3 — Deploy to Sepolia

```bash
cp .env.example .env
# Fill in SEPOLIA_RPC_URL and PRIVATE_KEY in .env
# Edit scripts/deploy.ts to set real recipient addresses
npx hardhat run scripts/deploy.ts --network sepolia
```

Copy the printed contract address into `frontend/.env.local`:

```bash
echo "VITE_CONTRACT_ADDRESS=0xYOUR_ADDRESS" > frontend/.env.local
```

### 4 — Run the frontend

```bash
cd frontend
npm install
npm run dev
# Opens http://localhost:5173
```

---

## Tests

```
npx hardhat test
```

| Test case | What it proves |
|---|---|
| TC-1 (×2) | Recipients pull their own payouts — no push loop |
| TC-2 | No privileged function can drain credited balances |
| TC-3 | Reentrancy guard blocks attacker from draining more than its share |
| TC-4 (×5) | setSplit() reverts unless shares sum to exactly 10 000 |
| TC-5 | Every wei of msg.value is credited — zero stranded |
| TC-6 (×2) | Credited amount equals msg.value, not a caller argument |
| TC-8 (×3) | Exact withdrawn amount asserted for each recipient |

---

## Security Notes

- **No credentials in this repo.** Private keys and RPC URLs must be placed in `.env` (which is git-ignored). See `.env.example`.
- The owner role can only update the *future* split configuration. Credited balances (`balances[addr]`) can only be moved by the recipient themselves via `withdraw()`.
- Reentrancy is prevented by both the Checks-Effects-Interactions pattern and OpenZeppelin's `ReentrancyGuard`.

---

## Stack

| Layer | Technology |
|---|---|
| Smart contract | Solidity 0.8.24 |
| Contract framework | Hardhat 2 + ethers.js v6 |
| Safety libraries | OpenZeppelin Contracts (ReentrancyGuard, Ownable) |
| Frontend | Vite + React + TypeScript |
| Wallet / chain | wagmi v2 + viem |
| Network | Ethereum Sepolia testnet |

---

## License

MIT
