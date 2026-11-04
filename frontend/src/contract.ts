// Auto-generated contract ABI and address config.
// Update CONTRACT_ADDRESS after deployment.

export const CONTRACT_ADDRESS = (
    import.meta.env.VITE_CONTRACT_ADDRESS ||
    "0x0000000000000000000000000000000000000000"
) as `0x${string}`;

export const SPLITTER_ABI = [
    // View functions
    {
        name: "BASIS_POINTS",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        name: "balances",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "account", type: "address" }],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        name: "getRecipients",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "address[]" }],
    },
    {
        name: "getShares",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint256[]" }],
    },
    {
        name: "recipientCount",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        name: "owner",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "address" }],
    },
    // Write functions
    {
        name: "fund",
        type: "function",
        stateMutability: "payable",
        inputs: [],
        outputs: [],
    },
    {
        name: "withdraw",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [],
        outputs: [],
    },
    // Events
    {
        name: "FundsReceived",
        type: "event",
        inputs: [
            { name: "sponsor", type: "address", indexed: true },
            { name: "amount", type: "uint256", indexed: false },
        ],
    },
    {
        name: "Withdrawn",
        type: "event",
        inputs: [
            { name: "recipient", type: "address", indexed: true },
            { name: "amount", type: "uint256", indexed: false },
        ],
    },
] as const;
