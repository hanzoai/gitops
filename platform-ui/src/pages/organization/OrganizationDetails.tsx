import { Layout } from '@/layouts/Layout';
import { Outlet, useLocation, useParams, Link } from 'react-router-dom';
import { cn } from '@/utils';

const ORG_TABS = [
	{ name: 'Projects', path: 'projects' },
	{ name: 'Cluster', path: 'cluster' },
];

export default function OrganizationDetails() {
	const { orgId } = useParams();
	const { pathname } = useLocation();

	const activeTab = ORG_TABS.find((tab) => pathname.includes(`/${tab.path}`))?.path || 'projects';

	return (
		<Layout>
			<div className='sticky top-0 z-40 bg-base border-b border-border'>
				<nav className='flex items-center justify-center h-[48px] mx-auto'>
					{ORG_TABS.map((tab) => (
						<Link
							key={tab.path}
							to={`/organization/${orgId}/${tab.path}`}
							className={cn(
								'flex items-center justify-center gap-2 px-8 pb-3 pt-3 text-xs border-b-[3px] border-transparent transition-colors',
								activeTab === tab.path
									? 'border-b-brand-primary text-brand-primary'
									: 'text-subtle hover:text-default',
							)}
						>
							{tab.name}
						</Link>
					))}
				</nav>
			</div>
			<Outlet />
		</Layout>
	);
}
