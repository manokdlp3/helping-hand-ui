import Link from 'next/link'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Button } from "@/components/ui/button"

export function Navbar() {
  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
              CampBuidl
            </h1>
          </Link>
        </div>
        <div className="hidden md:flex items-center space-x-6">
          <Button variant="ghost" asChild>
            <Link href="/examples/simple-storage">Simple Storage</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/examples/erc20">ERC20</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/examples/nft">NFT</Link>
          </Button>
        </div>
        <ConnectButton />
      </div>
    </nav>
  )
}
