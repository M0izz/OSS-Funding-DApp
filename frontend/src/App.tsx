import { useAccount, useConnect, useDisconnect } from "wagmi";
import { SplitView } from "./components/SplitView";
import { BalancePanel } from "./components/BalancePanel";
import { FundPanel } from "./components/FundPanel";
import { ContractInfo } from "./components/ContractInfo";
import { CONTRACT_ADDRESS } from "./contract";

export default function App() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  const short = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;

  return (
    <div className="app">
      {/* ── Hero header ─────────────────────────────────────────────────── */}
      <header className="hero">
        <div className="hero-content">
          <div className="hero-badge">Ethereum · Sepolia Testnet</div>
          <h1 className="hero-title">
            <span className="accent">Pay It</span> Upstream
          </h1>
          <p className="hero-sub">
            Transparent, trustless funding for open-source projects.
            <br />
            Every sponsor sends to one address; every contributor collects their own share.
          </p>

          {/* ── Wallet connect ──────────────────────────────────────────── */}
          <div className="wallet-bar">
            {isConnected ? (
              <div className="wallet-connected">
                <div className="wallet-dot" />
                <span className="wallet-addr">{short(address!)}</span>
                <button
                  id="btn-disconnect"
                  className="btn btn-ghost"
                  onClick={() => disconnect()}
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <div className="connect-group">
                {connectors.slice(0, 2).map((c) => (
                  <button
                    key={c.id}
                    id={`btn-connect-${c.id}`}
                    className="btn btn-primary"
                    onClick={() => connect({ connector: c })}
                  >
                    Connect {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Main grid ───────────────────────────────────────────────────── */}
      <main className="main-grid">
        {/* Contract info strip */}
        <ContractInfo address={CONTRACT_ADDRESS} />

        {/* Split table – reads from chain */}
        <section className="card wide">
          <SplitView />
        </section>

        {/* Balance + fund / withdraw row */}
        <section className="card">
          <FundPanel />
        </section>
        <section className="card">
          <BalancePanel />
        </section>
      </main>

      <footer className="site-footer">
        <p>
          Contract:{" "}
          <a
            href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`}
            target="_blank"
            rel="noopener noreferrer"
            id="link-etherscan"
          >
            {CONTRACT_ADDRESS}
          </a>
        </p>
        <p className="footer-note">
          All splits and balances are read directly from the Ethereum blockchain — no off-chain servers.
        </p>
      </footer>
    </div>
  );
}
