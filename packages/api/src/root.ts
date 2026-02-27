import { router } from './trpc'
import { clusterRouter } from './routers/cluster'
import { containerRouter } from './routers/container'
import { systemRouter } from './routers/system'
import { organizationRouter } from './routers/organization'
import { orgTeamRouter } from './routers/org-team'
import { projectRouter } from './routers/project'
import { environmentRouter } from './routers/environment'
import { buildRouter } from './routers/build'
import { logRouter } from './routers/log'
import { registryRouter } from './routers/registry'
import { domainRouter } from './routers/domain'
import { gitRouter } from './routers/git'
import { userRouter } from './routers/user'
import { provisionerRouter } from './routers/provisioner'
import { auditRouter } from './routers/audit'
import { invitationRouter } from './routers/invitation'
import { vmRouter } from './routers/vm'

export const appRouter = router({
  cluster: clusterRouter,
  container: containerRouter,
  system: systemRouter,
  organization: organizationRouter,
  orgTeam: orgTeamRouter,
  project: projectRouter,
  environment: environmentRouter,
  build: buildRouter,
  log: logRouter,
  registry: registryRouter,
  domain: domainRouter,
  git: gitRouter,
  user: userRouter,
  provisioner: provisionerRouter,
  audit: auditRouter,
  invitation: invitationRouter,
  vm: vmRouter,
})

export type AppRouter = typeof appRouter
