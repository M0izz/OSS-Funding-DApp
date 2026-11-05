import { useReadContract } from "wagmi";
import { SPLITTER_ABI } from "../contract";

interface ContractInfoProps {
    address: `0x${string}`;
}

export function ContractInfo({ address }: ContractInfoProps) {
    const { data: recipientCount } = useReadContract({
        address,
        abi: SPLITTER_ABI,
        functionName: "recipientCount",
    });

    return (
        <div className="contract-info-strip">
            <div className="info-chip">
                <span className="info-label">Contract</span>
                <span className="info-val mono">
                    {address.slice(0, 10)}…{address.slice(-8)}
                </span>
            </div>
            <div className="info-chip">
                <span className="info-label">Recipients</span>
                <span className="info-val">{recipientCount?.toString() ?? "…"}</span>
            </div>
            <div className="info-chip">
                <span className="info-label">Network</span>
                <span className="info-val">Sepolia</span>
            </div>
            <div className="info-chip">
                <span className="info-label">Payment model</span>
                <span className="info-val">Pull (recipient-initiated)</span>
            </div>
        </div>
    );
}
