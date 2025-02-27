import { useState } from 'react'
import { useContractRead, useContractWrite } from 'wagmi'
import { parseAbi } from 'viem'
import Head from 'next/head'
import { Navbar } from '@/components/Navbar'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"

export default function SimpleStorageExample() {
  const [value, setValue] = useState<string>('')

  const CONTRACT_ADDRESS = '0xYourSimpleStorageAddress'
  const CONTRACT_ABI = parseAbi([
    'function get() view returns (uint256)',
    'function set(uint256 value)'
  ])

  const { data: storedValue } = useContractRead({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'get'
  })

  const { writeContract, isPending: isLoading, isSuccess } = useContractWrite()

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <Head>
        <title>Simple Storage Example | CampBuidl</title>
        <meta content="Example of basic smart contract interactions" name="description" />
      </Head>

      <Navbar />

      <main className="container mx-auto p-8 max-w-4xl">
        <div className="text-center mb-16 py-12 px-4">
          <h1 className="text-5xl font-extrabold tracking-tight lg:text-6xl mb-6 bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
            Simple Storage Example
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Learn the basics of smart contract interactions with a simple storage contract.
          </p>
        </div>

        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Current Value</CardTitle>
              <CardDescription>The value currently stored in the contract</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xl">{storedValue?.toString() || '0'}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Update Value</CardTitle>
              <CardDescription>Store a new value in the contract</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">New Value</label>
                <input
                  type="number"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="border rounded px-3 py-2 w-full max-w-xs"
                  placeholder="Enter new value"
                />
              </div>
              <button
                onClick={() => writeContract({
                  address: CONTRACT_ADDRESS as `0x${string}`,
                  abi: CONTRACT_ABI,
                  functionName: 'set',
                  args: [BigInt(value || '0')]
                })}
                disabled={isLoading}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
              >
                {isLoading ? 'Updating...' : 'Update Value'}
              </button>
              {isSuccess && (
                <div className="text-green-500">
                  Value updated successfully!
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Code Example</CardTitle>
              <CardDescription>Learn how to interact with a simple storage contract</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-black p-4 rounded-lg overflow-x-auto">
                <code className="text-sm text-blue-50">{`// Read stored value
const { data } = useContractRead({
  address: CONTRACT_ADDRESS,
  abi: CONTRACT_ABI,
  functionName: 'get'
});

// Update stored value
const { writeContract } = useContractWrite();
writeContract({
  address: CONTRACT_ADDRESS,
  abi: CONTRACT_ABI,
  functionName: 'set',
  args: [newValue]
});`}</code>
              </pre>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
