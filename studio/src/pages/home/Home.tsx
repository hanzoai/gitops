import { Button } from '@/components/Button';
import { Hanzo } from '@/components/icons';

const IAM_ORIGIN = import.meta.env.VITE_IAM_ORIGIN || 'https://hanzo.id';
const IAM_CLIENT_ID = import.meta.env.VITE_IAM_CLIENT_ID || 'hanzo-platform-client-id';

function getLoginUrl() {
	const callbackUrl = `${window.location.origin}/login`;
	const state = btoa(JSON.stringify({ redirect: callbackUrl }));
	const params = new URLSearchParams({
		client_id: IAM_CLIENT_ID,
		redirect_uri: `${IAM_ORIGIN}/callback/platform/hanzo`,
		response_type: 'code',
		scope: 'openid profile email',
		state,
	});
	return `${IAM_ORIGIN}/login/oauth/authorize?${params.toString()}`;
}

export default function Home() {
	return (
		<div className='min-h-screen bg-base-900 flex flex-col'>
			{/* Nav */}
			<nav className='flex items-center justify-between px-8 py-4 border-b border-border'>
				<div className='flex items-center gap-3'>
					<Hanzo className='size-8 text-elements-strong-purple' />
					<span className='text-xl font-semibold text-default'>
						Hanzo Platform
					</span>
				</div>
				<a href={getLoginUrl()}>
					<Button variant='primary' size='lg'>
						Sign in
					</Button>
				</a>
			</nav>

			{/* Hero */}
			<main className='flex-1 flex items-center justify-center px-8'>
				<div className='max-w-3xl text-center space-y-8'>
					<h1 className='text-5xl font-bold text-default tracking-tight'>
						Deploy anything.
						<br />
						<span className='text-elements-strong-purple'>Scale everything.</span>
					</h1>
					<p className='text-lg text-subtle max-w-xl mx-auto'>
						The unified platform for deploying, managing, and scaling your
						applications. Push code, get a URL. Built on Kubernetes.
					</p>
					<div className='flex items-center justify-center gap-4'>
						<a href={getLoginUrl()}>
							<Button variant='primary' size='2xl'>
								Get Started
							</Button>
						</a>
						<a
							href='https://hanzo.ai/docs/platform'
							target='_blank'
							rel='noopener noreferrer'
						>
							<Button variant='secondary' size='2xl'>
								Documentation
							</Button>
						</a>
					</div>

					{/* Features grid */}
					<div className='grid grid-cols-3 gap-6 pt-12 text-left'>
						<div className='space-y-2 p-4 rounded-lg border border-border bg-base-800'>
							<h3 className='font-semibold text-default'>Git Push Deploy</h3>
							<p className='text-sm text-subtle'>
								Connect your repository, push code, and deploy automatically
								with zero-config CI/CD.
							</p>
						</div>
						<div className='space-y-2 p-4 rounded-lg border border-border bg-base-800'>
							<h3 className='font-semibold text-default'>Docker Native</h3>
							<p className='text-sm text-subtle'>
								Deploy any Docker image with custom domains, SSL, environment
								variables, and scaling.
							</p>
						</div>
						<div className='space-y-2 p-4 rounded-lg border border-border bg-base-800'>
							<h3 className='font-semibold text-default'>Multi-Cloud</h3>
							<p className='text-sm text-subtle'>
								Run on any Kubernetes cluster. Bring your own infra or use
								Hanzo Cloud.
							</p>
						</div>
					</div>
				</div>
			</main>

			{/* Footer */}
			<footer className='px-8 py-4 border-t border-border text-center text-xs text-subtle'>
				Hanzo AI &mdash; Techstars &apos;17
			</footer>
		</div>
	);
}
