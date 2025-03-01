import Link from 'next/link';
import ConnectWalletButton from './ConnectWalletButton';

export default function Navbar() {
  return (
    <nav className="bg-black text-white py-4 px-8">
      <div className="max-w-7xl mx-auto flex items-center">
        {/* LEFT: Logo + Brand */}
        <div className="flex-1 flex items-center space-x-3">
          <Link href="/">
            <img src="/logo.svg" alt="Logo" className="h-10 w-auto cursor-pointer" />
          </Link>
          <Link href="/">
            <span className="text-2xl md:text-3xl font-bold cursor-pointer">
              Helping Hands
            </span>
          </Link>
        </div>

        {/* MIDDLE: Nav Links */}
        <div className="flex-1 hidden md:flex justify-center items-center space-x-15 text-lg">
          <a href="/browse" className="hover:text-green-400">
            🔎 Browse
          </a>
          <a href="/lend" className="hover:text-green-400">
            🤝 Donate
          </a>
          <a href="/fundraise" className="hover:text-green-400">
            🫶 Fundraise
          </a>
        </div>

        {/* RIGHT: Connect Wallet */}
        <div className="flex-1 flex justify-end">
          <ConnectWalletButton />
        </div>
      </div>
    </nav>
  );
}
