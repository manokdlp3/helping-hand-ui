import { ConnectButton } from '@rainbow-me/rainbowkit';
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

// Add this at the top of the component to make external links more secure
const externalLinkProps = {
  target: "_blank",
  rel: "noopener noreferrer"
};

const Home: NextPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <Head>
        <title>Helping Hand - Crowd Funding on Blockchain</title>
        <meta
          content="A platform for crowdfunding on blockchain"
          name="description"
        />
        <link href="/favicon.ico" rel="icon" />
      </Head>

      {/* Enhanced Navigation Bar */}
      <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center space-x-2">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-green-800 to-green-500 bg-clip-text text-transparent">
                Helping Hand
              </h1>
            </Link>
          </div>
          <div className="hidden md:flex items-center space-x-6">
            <Button variant="ghost" asChild>
              <Link href="/examples/simple-storage">Lend a Hand</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/examples/erc20">Fundraise</Link>
            </Button>
          </div>
          <ConnectButton />
        </div>
      </nav>

      <main className="container mx-auto p-8 max-w-4xl">
        {/* Enhanced Hero Section */}
        <div className="text-center mb-16 py-12 px-4">
          <h1 className="text-5xl font-extrabold tracking-tight lg:text-6xl mb-6 bg-gradient-to-r from-green-800 to-green-500 bg-clip-text text-transparent animate-fade-in">
            Welcome to Helping Hand
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Your fundraising platform on blockchain.
          </p>
        </div>

        <div className="text-center mb-16 py-12 px-4">
          <Button variant="destructive">
            <Link href="/examples/simple-storage">Lend a Hand</Link>
          </Button>
        </div>

      </main>

      {/* Enhanced Footer */}
      <footer className="border-t mt-24 bg-background/50 backdrop-blur-sm">
        <div className="container flex flex-col items-center justify-between gap-4 py-10 md:h-24 md:flex-row md:py-0">
          <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
            Built with ❤️ for Web3 Development Learning
          </p>
          <div className="flex items-center space-x-6">
            <Link href="/docs" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Documentation
            </Link>
            <Link
              href="https://github.com"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              {...externalLinkProps}
            >
              GitHub
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
