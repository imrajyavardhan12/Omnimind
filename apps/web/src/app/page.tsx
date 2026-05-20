import LandingPage from './landing-page'

// Force dynamic rendering for this page (uses client-side auth)
export const dynamic = 'force-dynamic'

export default function Home() {
  return <LandingPage />
}
