import { Avatar, AvatarFallback, AvatarImage } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { AuthUserDropdown } from '@/features/auth/AuthUserDropdown';
import { ReleaseDropdown } from '@/features/cluster';
import { OrganizationCreateButton } from '@/features/organization';
import ClusterService from '@/services/ClusterService';
import useAuthStore from '@/store/auth/authStore';
import useOrganizationStore from '@/store/organization/organizationStore';
import { Organization } from '@/types';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate, useOutletContext } from 'react-router-dom';

import './organization.scss';
import { Loading } from '@/components/Loading';

type FleetCluster = {
	orgId: string;
	orgName: string;
	clusterName: string;
	region: string;
	status: string;
	ha: boolean;
	endpoint: string;
	nodePools: Array<{ name: string; size: string; count: number }>;
};

export default function OrganizationSelect() {
	const { organizations, selectOrganization, getAllOrganizationByUser } = useOrganizationStore();
	const { user } = useAuthStore();
	const { openOrgCreateModal } = useOutletContext<{
		openOrgCreateModal: () => void;
	}>();

	const navigate = useNavigate();
	const { t } = useTranslation();

	function handleClickOrganization(org: Organization) {
		selectOrganization(org);
		navigate(`/organization/${org?._id}/projects`);
	}

	const { isFetching } = useQuery({
		queryKey: ['organizations'],
		queryFn: getAllOrganizationByUser,
		refetchOnWindowFocus: false,
	});

	const { data: fleet } = useQuery({
		queryKey: ['doks-fleet'],
		queryFn: () => ClusterService.getDOKSFleet(),
		refetchOnWindowFocus: false,
	});

	const fleetByOrg = (fleet as FleetCluster[] | undefined)?.reduce(
		(acc: Record<string, FleetCluster>, c: FleetCluster) => {
			acc[c.orgId] = c;
			return acc;
		},
		{},
	) || {};

	const totalNodes = (fleet as FleetCluster[] | undefined)?.reduce(
		(sum: number, c: FleetCluster) => sum + c.nodePools.reduce((s: number, p) => s + p.count, 0),
		0,
	) || 0;

	const runningClusters = (fleet as FleetCluster[] | undefined)?.filter((c: FleetCluster) => c.status === 'running').length || 0;

	return (
		<div className='p-6 relative'>
			<div className='absolute right-6 flex items-center gap-1'>
				<ReleaseDropdown />
				<AuthUserDropdown />
			</div>
			<div className='select-organization-container'>
				{isFetching ? (
					<Loading loading={isFetching} />
				) : (
					<>
						{/* Fleet Overview */}
						{fleet && (fleet as FleetCluster[]).length > 0 && (
							<div className='mb-8 w-full max-w-3xl mx-auto'>
								<h2 className='text-lg font-semibold text-default mb-3'>Fleet Overview</h2>
								<div className='grid grid-cols-3 gap-4 mb-4'>
									<div className='rounded-lg border border-border bg-base-800 p-4 text-center'>
										<p className='text-2xl font-bold text-default'>{(fleet as FleetCluster[]).length}</p>
										<p className='text-xs text-subtle'>Clusters</p>
									</div>
									<div className='rounded-lg border border-border bg-base-800 p-4 text-center'>
										<p className='text-2xl font-bold text-elements-strong-green'>{runningClusters}</p>
										<p className='text-xs text-subtle'>Running</p>
									</div>
									<div className='rounded-lg border border-border bg-base-800 p-4 text-center'>
										<p className='text-2xl font-bold text-default'>{totalNodes}</p>
										<p className='text-xs text-subtle'>Total Nodes</p>
									</div>
								</div>
								<div className='rounded-lg border border-border bg-base-800 overflow-hidden'>
									<table className='w-full text-sm'>
										<thead>
											<tr className='border-b border-border'>
												<th className='text-left px-4 py-2 text-xs text-subtle font-medium'>Org</th>
												<th className='text-left px-4 py-2 text-xs text-subtle font-medium'>Cluster</th>
												<th className='text-left px-4 py-2 text-xs text-subtle font-medium'>Region</th>
												<th className='text-left px-4 py-2 text-xs text-subtle font-medium'>Status</th>
												<th className='text-left px-4 py-2 text-xs text-subtle font-medium'>HA</th>
												<th className='text-right px-4 py-2 text-xs text-subtle font-medium'>Nodes</th>
											</tr>
										</thead>
										<tbody>
											{(fleet as FleetCluster[]).map((c: FleetCluster) => (
												<tr
													key={c.orgId}
													className='border-b border-border last:border-0 hover:bg-base-900 cursor-pointer'
													onClick={() => {
														const org = organizations.find((o) => o._id === c.orgId);
														if (org) {
															selectOrganization(org);
															navigate(`/organization/${c.orgId}/cluster`);
														}
													}}
												>
													<td className='px-4 py-2 text-default font-medium'>{c.orgName}</td>
													<td className='px-4 py-2 text-subtle font-mono text-xs'>{c.clusterName}</td>
													<td className='px-4 py-2 text-subtle'>{c.region}</td>
													<td className='px-4 py-2'>
														<span
															className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
																c.status === 'running'
																	? 'bg-elements-subtle-green/20 text-elements-strong-green'
																	: c.status === 'provisioning'
																		? 'bg-elements-subtle-yellow/20 text-elements-strong-yellow'
																		: 'bg-elements-subtle-red/20 text-elements-strong-red'
															}`}
														>
															{c.status}
														</span>
													</td>
													<td className='px-4 py-2 text-subtle'>{c.ha ? 'Yes' : 'No'}</td>
													<td className='px-4 py-2 text-right text-default'>
														{c.nodePools.reduce((s, p) => s + p.count, 0)}
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</div>
						)}

						{!!organizations.length && (
							<h1 className='select-organization-title'>{t('organization.select')}</h1>
						)}
						<div className='select-organization-items'>
							{user?.canCreateOrg && <OrganizationCreateButton onClick={openOrgCreateModal} />}
							{organizations.length > 0 &&
								organizations.map((organization) => {
									const cluster = fleetByOrg[organization._id];
									return (
										<Button
											variant='blank'
											onClick={() => handleClickOrganization(organization)}
											key={organization?._id}
											className='select-organization-button !p-0'
										>
											<div className='select-organization-item'>
												<Avatar size='4xl' square>
													<AvatarImage src={organization.pictureUrl} alt={organization.name} />
													<AvatarFallback name={organization?.name} color={organization?.color} />
												</Avatar>
												<div className='select-organization-info'>
													<p className='select-organization-name'>{organization?.name}</p>
													<p className='select-organization-role'>{organization?.role}</p>
													{cluster && (
														<p className='text-xs text-subtle mt-0.5'>
															<span
																className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${
																	cluster.status === 'running'
																		? 'bg-elements-strong-green'
																		: 'bg-elements-strong-yellow'
																}`}
															/>
															{cluster.clusterName} &middot; {cluster.nodePools.reduce((s, p) => s + p.count, 0)} nodes
														</p>
													)}
												</div>
											</div>
										</Button>
									);
								})}
							{organizations.length === 0 && !user?.canCreateOrg && (
								<EmptyState type='org' title={t('organization.empty_organization')}>
									<p className='text-default'>{t('organization.empty_organization_desc')}</p>
								</EmptyState>
							)}
						</div>
					</>
				)}
			</div>
		</div>
	);
}
