import { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
import { CONTRACT_ADDRESS, SPLITTER_ABI } from "../contract";

export function FundPanel() {
    const { isConnected } = useAccount();
    const [ethAmount, setEthAmount] = useState("0.01");
    const { data: hash, writeContract, isPending, error } = useWriteContract();
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
        hash,
    });

    function handleFund() {
        if (!ethAmount || isNaN(Number(ethAmount))) return;
        writeContract({
            address: CONTRACT_ADDRESS,
            abi: SPLITTER_ABI,
            functionName: "fund",
            value: parseEther(ethAmount),
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
                            type="number"
                            min="0"
                            step="0.001"
                            value={ethAmount}
                            onChange={(e) => setEthAmount(e.target.value)}
                            className="input"
                            placeholder="0.01"
                        />
                    </div>
                </div>

                <button
                    id="btn-fund"
                    className="btn btn-green"
                    onClick={handleFund}
                    disabled={!isConnected || isPending || isConfirming}
                >
                    {isPending
                        ? "Confirm in wallet…"
                        : isConfirming
                            ? "Confirming…"
                            : "Fund Project ↗"}
                </button>
            </div>

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
