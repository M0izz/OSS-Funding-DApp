import { useReadContract } from "wagmi";
import { CONTRACT_ADDRESS, SPLITTER_ABI } from "../contract";

/** Ratio labels for known role patterns (display only — not used in logic). */
const ROLE_HINTS: Record<number, string> = {
    0: "Maintainer",
    1: "Upstream Lib 1",
    2: "Upstream Lib 2",
    3: "Upstream Lib 3",
    4: "Contributor 1",
    5: "Contributor 2",
    6: "Contributor 3",
    7: "Contributor 4",
    8: "Contributor 5",
    9: "Sponsor Reserve",
};

function bpToPercent(bp: bigint): string {
    return ((Number(bp) / 100)).toFixed(2) + "%";
}

function shortenAddress(addr: string): string {
    return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

function BarCell({ bp }: { bp: bigint }) {
    const pct = Number(bp) / 100;
    return (
        <div className="bar-cell">
            <div className="bar-track">
                <div className="bar-fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="bar-label">{bpToPercent(bp)}</span>
        </div>
    );
}

export function SplitView() {
    const { data: recipients, isLoading: rLoading } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: SPLITTER_ABI,
        functionName: "getRecipients",
    });

    const { data: shares, isLoading: sLoading } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: SPLITTER_ABI,
        functionName: "getShares",
    });

    const loading = rLoading || sLoading;

    return (
        <div className="split-view">
            <div className="card-header">
                <h2 className="card-title">
                    <span className="icon">⬡</span> Fund Distribution Split
                </h2>
                <p className="card-desc">
                    Shares are enforced on-chain. Data read live from the contract — no
                    hardcoding.
                </p>
            </div>

            {loading ? (
                <div className="loading-state">
                    <div className="spinner" />
                    <span>Reading split from blockchain…</span>
                </div>
            ) : !recipients || !shares ? (
                <div className="empty-state">
                    Connect to Sepolia to view the on-chain split.
                </div>
            ) : (
                <div className="table-wrapper">
                    <table className="split-table" id="split-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Role</th>
                                <th>Address</th>
                                <th>Basis Points</th>
                                <th>Share</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recipients.map((addr, i) => (
                                <tr key={addr} id={`split-row-${i}`} className="split-row">
                                    <td className="idx-cell">{i + 1}</td>
                                    <td className="role-cell">
                                        <span className="role-badge">
                                            {ROLE_HINTS[i] ?? `Recipient ${i + 1}`}
                                        </span>
                                    </td>
                                    <td className="addr-cell">
                                        <a
                                            href={`https://sepolia.etherscan.io/address/${addr}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="addr-link"
                                        >
                                            {shortenAddress(addr)}
                                        </a>
                                    </td>
                                    <td className="bp-cell">{shares[i]?.toString()}</td>
                                    <td>
                                        <BarCell bp={shares[i] ?? 0n} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colSpan={3} className="total-label">
                                    Total
                                </td>
                                <td className="total-bp">
                                    {shares.reduce((a, b) => a + b, 0n).toString()} bp
                                </td>
                                <td className="total-pct">100.00%</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}
        </div>
    );
}
