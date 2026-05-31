import { SignIn } from '@clerk/nextjs'

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <SignIn
        routing="hash"
        appearance={{ elements: { rootBox: 'mx-auto' } }}
        redirectUrl="/chat"
        signUpUrl="/auth/signup"
      />
    </div>
  )
}
