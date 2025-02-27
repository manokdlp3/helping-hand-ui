import { useState } from 'react'
import { useAccount, useContractRead, useContractWrite } from 'wagmi'
import { parseAbi } from 'viem'
import Head from 'next/head'
import { Navbar } from '@/components/Navbar'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"

export default function ERC20Example() {
  const [recipient, setRecipient] = useState<string>('')
  const [amount, setAmount] = useState<string>('')
  const { address } = useAccount()

  // Example ERC20 contract - replace with your contract address
  const CONTRACT_ADDRESS = '0xYourERC20ContractAddress'
  const CONTRACT_ABI = parseAbi([
    'function balanceOf(address account) view returns (uint256)',
    'function transfer(address to, uint256 amount) returns (bool)',
    'function name() view returns (string)',
    'function symbol() view returns (string)'
  ])

  const { data: balance } = useContractRead({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'balanceOf',
    args: [address as `0x${string}`]
  })

  const { data: tokenName } = useContractRead({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'name'
  })

  const { data: tokenSymbol } = useContractRead({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'symbol'
  })

  const { writeContract, isPending: isLoading, isSuccess } = useContractWrite()

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <Head>
        <title>ERC20 Example | CampBuidl</title>
        <meta content="Example of ERC20 token interactions" name="description" />
      </Head>

      <Navbar />

      <main className="container mx-auto p-8 max-w-4xl">
        <div className="text-center mb-16 py-12 px-4">
          <h1 className="text-5xl font-extrabold tracking-tight lg:text-6xl mb-6 bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
            ERC20 Token Example
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Learn how to interact with ERC20 tokens, including checking balances and making transfers.
          </p>
        </div>

        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Token Information</CardTitle>
              <CardDescription>View token details and your balance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xl">Name: {tokenName}</p>
              <p className="text-xl">Symbol: {tokenSymbol}</p>
              <p className="text-xl">Your Balance: {balance?.toString() || '0'} {tokenSymbol}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Transfer Tokens</CardTitle>
              <CardDescription>Send tokens to another address</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Recipient Address</label>
                <input
                  type="text"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  className="border rounded px-3 py-2 w-full max-w-md"
                  placeholder="0x..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Amount</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="border rounded px-3 py-2 w-full max-w-xs"
                  placeholder="Enter amount"
                />
              </div>
              <button
                onClick={() => writeContract({
                  address: CONTRACT_ADDRESS as `0x${string}`,
                  abi: CONTRACT_ABI,
                  functionName: 'transfer',
                  args: [recipient as `0x${string}`, BigInt(amount || '0')]
                })}
                disabled={isLoading}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
              >
                {isLoading ? 'Transferring...' : 'Transfer Tokens'}
              </button>
              {isSuccess && (
                <div className="text-green-500">
                  Transfer successful!
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Code Example</CardTitle>
              <CardDescription>Learn how to transfer ERC20 tokens</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-black p-4 rounded-lg overflow-x-auto">
                <code className="text-sm text-blue-50">{`// Transfer ERC20 tokens
const { writeContract } = useContractWrite();

writeContract({
  address: CONTRACT_ADDRESS,
  abi: CONTRACT_ABI,
  functionName: 'transfer',
  args: [recipientAddress, amount]
});`}</code>
              </pre>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
