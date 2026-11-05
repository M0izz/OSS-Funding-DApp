import { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
import { CONTRACT_ADDRESS, SPLITTER_ABI } from "../contract";

function validateEthAmount(amount: string): { value?: bigint; error?: string } {
    const trimmedAmount = amount.trim();
    if (!trimmedAmount) {
        return { error: "Enter an ETH amount." };
    }

    if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(trimmedAmount)) {
        return { error: "Enter a valid positive ETH amount." };
    }

    const decimalPlaces = trimmedAmount.split(".")[1]?.length ?? 0;
    if (decimalPlaces > 18) {
        return { error: "ETH amounts can have at most 18 decimal places." };
    }

    try {
        const value = parseEther(trimmedAmount);
        if (value <= 0n) {
            return { error: "Funding amount must be greater than zero." };
        }
        return { value };
    } catch {
        return { error: "Enter a valid positive ETH amount." };
    }
}

export function FundPanel() {
    const { isConnected } = useAccount();
    const [ethAmount, setEthAmount] = useState("0.01");
    const amountValidation = validateEthAmount(ethAmount);
    const { data: hash, writeContract, isPending, error } = useWriteContract();
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
        hash,
    });

    function handleFund() {
        const validation = validateEthAmount(ethAmount);
        if (validation.value === undefined) return;

        writeContract({
            address: CONTRACT_ADDRESS,
            abi: SPLITTER_ABI,
            functionName: "fund",
            value: validation.value,
        });
    }

    return (
        <div className="panel fund-panel">
            <div className="card-header">
                <h2 className="card-title">
                    <span className="icon">💚</span> Sponsor the Project
                </h2>
                <p className="card-desc">
                    Send ETH to the contract. Shares are distributed instantly to all
                    recipients — no middleman.
                </p>
            </div>

            <div className="input-row">
                <div className="input-group">
                    <label htmlFor="fund-amount" className="input-label">
                        Amount (ETH)
                    </label>
                    <div className="input-wrapper">
                        <span className="input-prefix">Ξ</span>
                        <input
                            id="fund-amount"
                            type="text"
                            inputMode="decimal"
                            value={ethAmount}
                            onChange={(e) => setEthAmount(e.target.value)}
                            className="input"
                            placeholder="0.01"
                            aria-invalid={amountValidation.error !== undefined}
                            aria-describedby="fund-amount-error"
                        />
                    </div>
                </div>

                <button
                    id="btn-fund"
                    className="btn btn-green"
                    onClick={handleFund}
                    disabled={
                        !isConnected ||
                        amountValidation.value === undefined ||
                        isPending ||
                        isConfirming
                    }
                >
                    {isPending
                        ? "Confirm in wallet…"
                        : isConfirming
                            ? "Confirming…"
                            : "Fund Project ↗"}
                </button>
            </div>

            {amountValidation.error && (
                <div id="fund-amount-error" className="alert alert-error" role="alert">
                    {amountValidation.error}
                </div>
            )}

            {isSuccess && (
                <div className="alert alert-success">
                    ✓ Funded! Shares credited to all recipients.{" "}
                    <a
                        href={`https://sepolia.etherscan.io/tx/${hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        View tx ↗
                    </a>
                </div>
            )}
            {error && (
                <div className="alert alert-error">
                    ✗ {(error as Error).message?.slice(0, 120)}
                </div>
            )}

            {!isConnected && (
                <p className="helper-note">Connect your wallet to fund this project.</p>
            )}
        </div>
    );
}
