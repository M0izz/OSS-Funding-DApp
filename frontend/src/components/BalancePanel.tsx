import { useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { formatEther } from "viem";
import { CONTRACT_ADDRESS, SPLITTER_ABI } from "../contract";

export function BalancePanel() {
    const { address, isConnected } = useAccount();

    const { data: balance, refetch } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: SPLITTER_ABI,
        functionName: "balances",
        args: address ? [address] : undefined,
        query: { enabled: !!address },
    });

    const { data: hash, writeContract, isPending, error } = useWriteContract();
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
        hash,
    });

    function handleWithdraw() {
        writeContract({
            address: CONTRACT_ADDRESS,
            abi: SPLITTER_ABI,
            functionName: "withdraw",
        });
    }

    useEffect(() => {
        if (isSuccess) {
            void refetch();
        }
    }, [isSuccess, refetch]);

    const hasBalance = balance !== undefined && balance > 0n;

    return (
        <div className="panel balance-panel">
            <div className="card-header">
                <h2 className="card-title">
                    <span className="icon">⬇</span> Your Balance
                </h2>
                <p className="card-desc">
                    Your credited share of incoming sponsor funds. Only you can withdraw it.
                </p>
            </div>

            {!isConnected ? (
                <p className="helper-note">Connect your wallet to see your balance.</p>
            ) : (
                <>
                    <div className="balance-display" id="balance-display">
                        <span className="balance-amount">
                            {balance !== undefined ? formatEther(balance) : "…"}
                        </span>
                        <span className="balance-unit">ETH</span>
                    </div>

                    {hasBalance && (
                        <div className="balance-usd">
                            Available to withdraw
                        </div>
                    )}

                    <button
                        id="btn-withdraw"
                        className="btn btn-primary withdraw-btn"
                        onClick={handleWithdraw}
                        disabled={!hasBalance || isPending || isConfirming}
                    >
                        {isPending
                            ? "Confirm in wallet…"
                            : isConfirming
                                ? "Confirming…"
                                : hasBalance
                                    ? "Withdraw My Share"
                                    : "Nothing to Withdraw"}
                    </button>

                    {isSuccess && (
                        <div className="alert alert-success">
                            ✓ Withdrawn!{" "}
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
                </>
            )}
        </div>
    );
}
