import Head from 'next/head';
import Navbar from '../components/Navbar';
import Link from 'next/link';

export default function Home() {
  return (
    <>
      <Head>
        <title>Helping Hands</title>
        <meta name="description" content="Fundraising, Verified & Simplified" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="flex flex-col h-screen overflow-hidden bg-black text-white">
        {/* NAVBAR */}
        <Navbar />

        {/* HERO SECTION */}
        <div className="relative flex-1">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: 'url("/hero.svg")',
              filter: 'blur(1px)',
            }}
          ></div>

          {/* Dark Overlay */}
          <div className="absolute inset-0 bg-black opacity-40"></div>

          {/* Content Wrapper */}
          <div className="relative z-10 flex flex-col items-center justify-center h-full px-4">
            {/* Large Heading */}
            <h1 className="text-4xl md:text-6xl font-bold italic mb-20 text-center">
              FUNDRAISING, VERIFIED &amp; SIMPLIFIED
            </h1>

            {/* Semi-Transparent Box */}
            <div className="bg-[rgba(63,63,63,0.5)] rounded-xl p-8 md:p-12 max-w-6xl w-full min-h-[450px] flex items-center">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-full w-full items-center justify-items-center">
                {/* LEFT COLUMN */}
                <div className="justify-self-start text-left italic">
                  <p className="text-xl md:text-3xl font-bold mb-16">
                    Helping Hands leverages the <span className="underline">Humanity Protocol</span> for verifiable identities
                    and transparent contributions.
                  </p>
                  <p className="text-xl md:text-3xl font-bold">
                    <span className="underline">Launch your campaign</span> today and watch your community come together
                    for a shared cause.
                  </p>
                </div>

                {/* RIGHT COLUMN */}
                <div className="flex flex-col items-center justify-center">
                  <Link href="/fundraise">
                    <button className="bg-green-500 hover:bg-green-600 text-white px-10 py-4 rounded-md font-bold text-xl md:text-xl">
                      Start your fundraiser
                    </button>
                  </Link>
                  <span className="my-8 text-lg italic md:text-xl font-bold">-or-</span>
                  <Link href="/browse">
                    <button className="bg-green-500 hover:bg-green-600 text-white px-10 py-4 rounded-md font-bold text-xl md:text-xl">
                      Explore fundraisers
                    </button>
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* HUMANITY PROTOCOL LOGO */}
          <img
            src="/hp.svg"
            alt="Humanity Protocol Logo"
            className="absolute bottom-4 right-4 w-18 h-auto opacity-90"
          />
        </div>
      </div>
    </>
  );
}
