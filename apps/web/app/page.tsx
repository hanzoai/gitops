import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { AutoSignIn } from './auto-signin'

export default async function Home() {
  const session = await auth()

  if (session?.user) {
    redirect('/orgs')
  }

  // Render a client component that auto-triggers the OIDC flow
  return <AutoSignIn />
}
