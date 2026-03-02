-- =============================================================================
-- PaaS Database Seed: All Clusters, Namespaces, and Containers
-- =============================================================================
-- Idempotent: uses ON CONFLICT (id) DO NOTHING throughout.
-- Prerequisite: existing user usr-hanzo-admin-001, org org-hanzo-001,
--   cluster 1a153000-90a6-48ad-9375-7ef901a9bf7f (hanzo-k8s),
--   project prj-hanzo-cloud-001, environment env-hanzo-prod-001,
--   and 44 containers in hanzo namespace.
-- =============================================================================

BEGIN;

-- =====================================================================
-- 1. LUX ORGANIZATION
-- =====================================================================
INSERT INTO organizations (id, iid, name, owner_user_id, is_cluster_entity, created_by, created_at, updated_at)
VALUES ('org-lux-001', 'org-lux-001', 'Lux Network', 'usr-hanzo-admin-001', true, 'usr-hanzo-admin-001', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Admin membership in Lux org
INSERT INTO org_members (id, org_id, user_id, role, joined_at)
VALUES ('om-lux-admin-001', 'org-lux-001', 'usr-hanzo-admin-001', 'Admin', NOW())
ON CONFLICT (id) DO NOTHING;

-- Admin membership in Hanzo org (ensure exists)
INSERT INTO org_members (id, org_id, user_id, role, joined_at)
VALUES ('om-hanzo-admin-001', 'org-hanzo-001', 'usr-hanzo-admin-001', 'Admin', NOW())
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- 2. LUX-K8S CLUSTER
-- =====================================================================
INSERT INTO clusters (id, slug, name, type, provider, status, cloud_region, org_id, created_by, created_at, updated_at)
VALUES (
  '04c46df5-5986-429a-9c7f-3f11a81c8539',
  'lux-k8s-sfo3',
  'Lux K8s (SFO3)',
  'kubernetes',
  'digitalocean',
  'running',
  'sfo3',
  'org-lux-001',
  'usr-hanzo-admin-001',
  NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- 3. PROJECTS
-- =====================================================================

-- Lux on Hanzo-K8s (lux namespaces running on hanzo-k8s cluster)
INSERT INTO projects (id, iid, org_id, owner_user_id, name, is_cluster_entity, created_by, created_at, updated_at)
VALUES ('prj-lux-hanzo-001', 'prj-lux-hanzo-001', 'org-lux-001', 'usr-hanzo-admin-001', 'Lux on Hanzo-K8s', true, 'usr-hanzo-admin-001', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Lux Infrastructure (lux namespaces on lux-k8s cluster)
INSERT INTO projects (id, iid, org_id, owner_user_id, name, is_cluster_entity, created_by, created_at, updated_at)
VALUES ('prj-lux-infra-001', 'prj-lux-infra-001', 'org-lux-001', 'usr-hanzo-admin-001', 'Lux Infrastructure', true, 'usr-hanzo-admin-001', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- 4. ENVIRONMENTS
-- =====================================================================

-- ----- Hanzo org, Hanzo Cloud project, on hanzo-k8s -----
INSERT INTO environments (id, iid, org_id, project_id, name, read_only, is_cluster_entity, created_by, created_at, updated_at) VALUES
  ('env-hanzo-bootnode', 'env-hanzo-bootnode', 'org-hanzo-001', 'prj-hanzo-cloud-001', 'bootnode',  true, true, 'usr-hanzo-admin-001', NOW(), NOW()),
  ('env-hanzo-zt',       'env-hanzo-zt',       'org-hanzo-001', 'prj-hanzo-cloud-001', 'hanzo-zt', true, true, 'usr-hanzo-admin-001', NOW(), NOW()),
  ('env-hanzo-team',     'env-hanzo-team',     'org-hanzo-001', 'prj-hanzo-cloud-001', 'team',     true, true, 'usr-hanzo-admin-001', NOW(), NOW()),
  ('env-hanzo-zen',      'env-hanzo-zen',      'org-hanzo-001', 'prj-hanzo-cloud-001', 'zen',      true, true, 'usr-hanzo-admin-001', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ----- Lux org, "Lux on Hanzo-K8s" project, on hanzo-k8s -----
INSERT INTO environments (id, iid, org_id, project_id, name, read_only, is_cluster_entity, created_by, created_at, updated_at) VALUES
  ('env-lux-bridge-hk',   'env-lux-bridge-hk',   'org-lux-001', 'prj-lux-hanzo-001', 'lux-bridge',   true, true, 'usr-hanzo-admin-001', NOW(), NOW()),
  ('env-lux-devnet-hk',   'env-lux-devnet-hk',   'org-lux-001', 'prj-lux-hanzo-001', 'lux-devnet',   true, true, 'usr-hanzo-admin-001', NOW(), NOW()),
  ('env-lux-explorer-hk', 'env-lux-explorer-hk', 'org-lux-001', 'prj-lux-hanzo-001', 'lux-explorer', true, true, 'usr-hanzo-admin-001', NOW(), NOW()),
  ('env-lux-gateway-hk',  'env-lux-gateway-hk',  'org-lux-001', 'prj-lux-hanzo-001', 'lux-gateway',  true, true, 'usr-hanzo-admin-001', NOW(), NOW()),
  ('env-lux-mainnet-hk',  'env-lux-mainnet-hk',  'org-lux-001', 'prj-lux-hanzo-001', 'lux-mainnet',  true, true, 'usr-hanzo-admin-001', NOW(), NOW()),
  ('env-lux-mpc-hk',      'env-lux-mpc-hk',      'org-lux-001', 'prj-lux-hanzo-001', 'lux-mpc',      true, true, 'usr-hanzo-admin-001', NOW(), NOW()),
  ('env-lux-system-hk',   'env-lux-system-hk',   'org-lux-001', 'prj-lux-hanzo-001', 'lux-system',   true, true, 'usr-hanzo-admin-001', NOW(), NOW()),
  ('env-lux-testnet-hk',  'env-lux-testnet-hk',  'org-lux-001', 'prj-lux-hanzo-001', 'lux-testnet',  true, true, 'usr-hanzo-admin-001', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ----- Lux org, "Lux Infrastructure" project, on lux-k8s -----
INSERT INTO environments (id, iid, org_id, project_id, name, read_only, is_cluster_entity, created_by, created_at, updated_at) VALUES
  ('env-lux-bridge',   'env-lux-bridge',   'org-lux-001', 'prj-lux-infra-001', 'lux-bridge',   true, true, 'usr-hanzo-admin-001', NOW(), NOW()),
  ('env-lux-explorer', 'env-lux-explorer', 'org-lux-001', 'prj-lux-infra-001', 'lux-explorer', true, true, 'usr-hanzo-admin-001', NOW(), NOW()),
  ('env-lux-gateway',  'env-lux-gateway',  'org-lux-001', 'prj-lux-infra-001', 'lux-gateway',  true, true, 'usr-hanzo-admin-001', NOW(), NOW()),
  ('env-lux-mpc',      'env-lux-mpc',      'org-lux-001', 'prj-lux-infra-001', 'lux-mpc',      true, true, 'usr-hanzo-admin-001', NOW(), NOW()),
  ('env-lux-system',   'env-lux-system',   'org-lux-001', 'prj-lux-infra-001', 'lux-system',   true, true, 'usr-hanzo-admin-001', NOW(), NOW()),
  ('env-lux-devnet',   'env-lux-devnet',   'org-lux-001', 'prj-lux-infra-001', 'lux-devnet',   true, true, 'usr-hanzo-admin-001', NOW(), NOW()),
  ('env-lux-mainnet',  'env-lux-mainnet',  'org-lux-001', 'prj-lux-infra-001', 'lux-mainnet',  true, true, 'usr-hanzo-admin-001', NOW(), NOW()),
  ('env-lux-testnet',  'env-lux-testnet',  'org-lux-001', 'prj-lux-infra-001', 'lux-testnet',  true, true, 'usr-hanzo-admin-001', NOW(), NOW()),
  ('env-lux-zoo',      'env-lux-zoo',      'org-lux-001', 'prj-lux-infra-001', 'zoo',          true, true, 'usr-hanzo-admin-001', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;


-- =====================================================================
-- 5. CONTAINERS — hanzo-k8s (1a153000-90a6-48ad-9375-7ef901a9bf7f)
-- =====================================================================
-- Shorthand aliases for readability:
--   HK_CLUSTER = '1a153000-90a6-48ad-9375-7ef901a9bf7f'
--   LK_CLUSTER = '04c46df5-5986-429a-9c7f-3f11a81c8539'

-- ---------------------------------------------------------------------
-- 5a. bootnode namespace (5 services) — env-hanzo-bootnode
-- ---------------------------------------------------------------------
INSERT INTO containers (id, iid, slug, name, type, org_id, project_id, environment_id, cluster_id, source_type, registry_config, networking, deployment_config, variables, is_cluster_entity, created_by, created_at, updated_at) VALUES
(
  'ctr-hk-bootnode-api', 'ctr-hk-bootnode-api', 'hk-bootnode-api', 'bootnode-api',
  'deployment', 'org-hanzo-001', 'prj-hanzo-cloud-001', 'env-hanzo-bootnode',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/hanzoai/bootnode-api","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":3000,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":3}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-hk-bootnode-web', 'ctr-hk-bootnode-web', 'hk-bootnode-web', 'bootnode-web',
  'deployment', 'org-hanzo-001', 'prj-hanzo-cloud-001', 'env-hanzo-bootnode',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/hanzoai/bootnode-web","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":80,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":2}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-hk-bootnode-hanzo-web3', 'ctr-hk-bootnode-hanzo-web3', 'hk-bootnode-hanzo-web3', 'hanzo-web3',
  'deployment', 'org-hanzo-001', 'prj-hanzo-cloud-001', 'env-hanzo-bootnode',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/hanzoai/hanzo-web3","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":80,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":2}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-hk-bootnode-lux-cloud-web', 'ctr-hk-bootnode-lux-cloud-web', 'hk-bootnode-lux-cloud-web', 'lux-cloud-web',
  'deployment', 'org-hanzo-001', 'prj-hanzo-cloud-001', 'env-hanzo-bootnode',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/hanzoai/lux-cloud-web","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":80,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":2}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-hk-bootnode-pars-cloud-web', 'ctr-hk-bootnode-pars-cloud-web', 'hk-bootnode-pars-cloud-web', 'pars-cloud-web',
  'deployment', 'org-hanzo-001', 'prj-hanzo-cloud-001', 'env-hanzo-bootnode',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/hanzoai/pars-cloud-web","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":80,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":2}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 5b. hanzo-zt namespace (5 services) — env-hanzo-zt
-- ---------------------------------------------------------------------
INSERT INTO containers (id, iid, slug, name, type, org_id, project_id, environment_id, cluster_id, source_type, registry_config, networking, deployment_config, variables, is_cluster_entity, created_by, created_at, updated_at) VALUES
(
  'ctr-hk-zt-console', 'ctr-hk-zt-console', 'hk-zt-console', 'hanzo-zt-console',
  'deployment', 'org-hanzo-001', 'prj-hanzo-cloud-001', 'env-hanzo-zt',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/hanzoai/zt-console","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":3000,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-hk-zt-controller', 'ctr-hk-zt-controller', 'hk-zt-controller', 'hanzo-zt-controller',
  'deployment', 'org-hanzo-001', 'prj-hanzo-cloud-001', 'env-hanzo-zt',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/hanzoai/zt-controller","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":9993,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-hk-zt-mcp-gateway', 'ctr-hk-zt-mcp-gateway', 'hk-zt-mcp-gateway', 'hanzo-zt-mcp-gateway',
  'deployment', 'org-hanzo-001', 'prj-hanzo-cloud-001', 'env-hanzo-zt',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/hanzoai/zt-mcp-gateway","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":8080,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-hk-zt-router', 'ctr-hk-zt-router', 'hk-zt-router', 'hanzo-zt-router',
  'deployment', 'org-hanzo-001', 'prj-hanzo-cloud-001', 'env-hanzo-zt',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/hanzoai/zt-router","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":9993,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-hk-zt-zrok', 'ctr-hk-zt-zrok', 'hk-zt-zrok', 'zrok-controller',
  'deployment', 'org-hanzo-001', 'prj-hanzo-cloud-001', 'env-hanzo-zt',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/hanzoai/zrok","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":18080,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 5c. team namespace (11 services) — env-hanzo-team
-- ---------------------------------------------------------------------
INSERT INTO containers (id, iid, slug, name, type, org_id, project_id, environment_id, cluster_id, source_type, registry_config, networking, deployment_config, variables, is_cluster_entity, created_by, created_at, updated_at) VALUES
(
  'ctr-hk-team-account', 'ctr-hk-team-account', 'hk-team-account', 'account',
  'deployment', 'org-hanzo-001', 'prj-hanzo-cloud-001', 'env-hanzo-team',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/hanzoai/team-account","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":3000,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-hk-team-ai-bot', 'ctr-hk-team-ai-bot', 'hk-team-ai-bot', 'ai-bot',
  'deployment', 'org-hanzo-001', 'prj-hanzo-cloud-001', 'env-hanzo-team',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/hanzoai/team-ai-bot","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":4010,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-hk-team-collaborator', 'ctr-hk-team-collaborator', 'hk-team-collaborator', 'collaborator',
  'deployment', 'org-hanzo-001', 'prj-hanzo-cloud-001', 'env-hanzo-team',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/hanzoai/team-collaborator","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":3078,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-hk-team-elastic', 'ctr-hk-team-elastic', 'hk-team-elastic', 'elastic',
  'deployment', 'org-hanzo-001', 'prj-hanzo-cloud-001', 'env-hanzo-team',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"docker.elastic.co/elasticsearch/elasticsearch","tag":"7.14.2","registry_type":"Docker"}'::jsonb,
  '{"ports":[{"containerPort":9200,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-hk-team-front', 'ctr-hk-team-front', 'hk-team-front', 'front',
  'deployment', 'org-hanzo-001', 'prj-hanzo-cloud-001', 'env-hanzo-team',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/hanzoai/team-front","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":8083,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-hk-team-fulltext', 'ctr-hk-team-fulltext', 'hk-team-fulltext', 'fulltext',
  'deployment', 'org-hanzo-001', 'prj-hanzo-cloud-001', 'env-hanzo-team',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/hanzoai/team-fulltext","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":4700,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-hk-team-rekoni', 'ctr-hk-team-rekoni', 'hk-team-rekoni', 'rekoni',
  'deployment', 'org-hanzo-001', 'prj-hanzo-cloud-001', 'env-hanzo-team',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/hanzoai/team-rekoni","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":4004,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-hk-team-stats', 'ctr-hk-team-stats', 'hk-team-stats', 'stats',
  'deployment', 'org-hanzo-001', 'prj-hanzo-cloud-001', 'env-hanzo-team',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/hanzoai/team-stats","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":8080,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-hk-team-nginx', 'ctr-hk-team-nginx', 'hk-team-nginx', 'team-nginx',
  'deployment', 'org-hanzo-001', 'prj-hanzo-cloud-001', 'env-hanzo-team',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"nginx","tag":"alpine","registry_type":"Docker"}'::jsonb,
  '{"ports":[{"containerPort":80,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-hk-team-transactor', 'ctr-hk-team-transactor', 'hk-team-transactor', 'transactor',
  'deployment', 'org-hanzo-001', 'prj-hanzo-cloud-001', 'env-hanzo-team',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/hanzoai/team-transactor","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":3333,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-hk-team-workspace', 'ctr-hk-team-workspace', 'hk-team-workspace', 'workspace',
  'deployment', 'org-hanzo-001', 'prj-hanzo-cloud-001', 'env-hanzo-team',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/hanzoai/team-workspace","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":3000,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 5d. zen namespace (2 services) — env-hanzo-zen
-- ---------------------------------------------------------------------
INSERT INTO containers (id, iid, slug, name, type, org_id, project_id, environment_id, cluster_id, source_type, registry_config, networking, deployment_config, variables, is_cluster_entity, created_by, created_at, updated_at) VALUES
(
  'ctr-hk-zen-gateway', 'ctr-hk-zen-gateway', 'hk-zen-gateway', 'zen-gateway',
  'deployment', 'org-hanzo-001', 'prj-hanzo-cloud-001', 'env-hanzo-zen',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/hanzoai/zen","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":8080,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-hk-zen-landing', 'ctr-hk-zen-landing', 'hk-zen-landing', 'zen-landing',
  'deployment', 'org-hanzo-001', 'prj-hanzo-cloud-001', 'env-hanzo-zen',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/hanzoai/zen-landing","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":80,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 5e. lux-bridge namespace on hanzo-k8s (5 services) — env-lux-bridge-hk
-- ---------------------------------------------------------------------
INSERT INTO containers (id, iid, slug, name, type, org_id, project_id, environment_id, cluster_id, source_type, registry_config, networking, deployment_config, variables, is_cluster_entity, created_by, created_at, updated_at) VALUES
(
  'ctr-hk-lux-bridge-server', 'ctr-hk-lux-bridge-server', 'hk-lux-bridge-server', 'bridge-server',
  'deployment', 'org-lux-001', 'prj-lux-hanzo-001', 'env-lux-bridge-hk',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/luxfi/bridge-server","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":3000,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":2}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-hk-lux-bridge-ui', 'ctr-hk-lux-bridge-ui', 'hk-lux-bridge-ui', 'bridge-ui',
  'deployment', 'org-lux-001', 'prj-lux-hanzo-001', 'env-lux-bridge-hk',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/luxfi/bridge-ui","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":80,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":2}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-hk-lux-bridge-kv', 'ctr-hk-lux-bridge-kv', 'hk-lux-bridge-kv', 'kv',
  'deployment', 'org-lux-001', 'prj-lux-hanzo-001', 'env-lux-bridge-hk',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/hanzoai/kv","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":6379,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO containers (id, iid, slug, name, type, org_id, project_id, environment_id, cluster_id, source_type, registry_config, networking, stateful_set_config, variables, is_cluster_entity, created_by, created_at, updated_at) VALUES
(
  'ctr-hk-lux-bridge-mpc-node', 'ctr-hk-lux-bridge-mpc-node', 'hk-lux-bridge-mpc-node', 'mpc-node',
  'statefulset', 'org-lux-001', 'prj-lux-hanzo-001', 'env-lux-bridge-hk',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/luxfi/mpc-node","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":8545,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":3}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-hk-lux-bridge-postgres', 'ctr-hk-lux-bridge-postgres', 'hk-lux-bridge-postgres', 'postgres',
  'statefulset', 'org-lux-001', 'prj-lux-hanzo-001', 'env-lux-bridge-hk',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"postgres","tag":"15","registry_type":"Docker"}'::jsonb,
  '{"ports":[{"containerPort":5432,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 5f. lux-devnet namespace on hanzo-k8s (2 services) — env-lux-devnet-hk
-- ---------------------------------------------------------------------
INSERT INTO containers (id, iid, slug, name, type, org_id, project_id, environment_id, cluster_id, source_type, registry_config, networking, deployment_config, variables, is_cluster_entity, created_by, created_at, updated_at) VALUES
(
  'ctr-hk-lux-devnet-gateway', 'ctr-hk-lux-devnet-gateway', 'hk-lux-devnet-gateway', 'api-gateway-gateway',
  'deployment', 'org-lux-001', 'prj-lux-hanzo-001', 'env-lux-devnet-hk',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/luxfi/api-gateway","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":8080,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO containers (id, iid, slug, name, type, org_id, project_id, environment_id, cluster_id, source_type, registry_config, networking, stateful_set_config, variables, is_cluster_entity, created_by, created_at, updated_at) VALUES
(
  'ctr-hk-lux-devnet-luxd', 'ctr-hk-lux-devnet-luxd', 'hk-lux-devnet-luxd', 'luxd',
  'statefulset', 'org-lux-001', 'prj-lux-hanzo-001', 'env-lux-devnet-hk',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/luxfi/luxd","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":9650,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":5}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 5g. lux-explorer namespace on hanzo-k8s (34 services) — env-lux-explorer-hk
-- ---------------------------------------------------------------------

-- Blockscout instances (5 deployments)
INSERT INTO containers (id, iid, slug, name, type, org_id, project_id, environment_id, cluster_id, source_type, registry_config, networking, deployment_config, variables, is_cluster_entity, created_by, created_at, updated_at) VALUES
(
  'ctr-hk-explorer-bs-hanzo', 'ctr-hk-explorer-bs-hanzo', 'hk-explorer-bs-hanzo', 'blockscout-hanzo',
  'deployment', 'org-lux-001', 'prj-lux-hanzo-001', 'env-lux-explorer-hk',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/luxfi/blockscout","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":4000,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-hk-explorer-bs-mainnet', 'ctr-hk-explorer-bs-mainnet', 'hk-explorer-bs-mainnet', 'blockscout-mainnet',
  'deployment', 'org-lux-001', 'prj-lux-hanzo-001', 'env-lux-explorer-hk',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/luxfi/blockscout","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":4000,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-hk-explorer-bs-pars', 'ctr-hk-explorer-bs-pars', 'hk-explorer-bs-pars', 'blockscout-pars',
  'deployment', 'org-lux-001', 'prj-lux-hanzo-001', 'env-lux-explorer-hk',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/luxfi/blockscout","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":4000,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-hk-explorer-bs-spc', 'ctr-hk-explorer-bs-spc', 'hk-explorer-bs-spc', 'blockscout-spc',
  'deployment', 'org-lux-001', 'prj-lux-hanzo-001', 'env-lux-explorer-hk',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/luxfi/blockscout","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":4000,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-hk-explorer-bs-zoo', 'ctr-hk-explorer-bs-zoo', 'hk-explorer-bs-zoo', 'blockscout-zoo',
  'deployment', 'org-lux-001', 'prj-lux-hanzo-001', 'env-lux-explorer-hk',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/luxfi/blockscout","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":4000,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Frontends (5 deployments)
INSERT INTO containers (id, iid, slug, name, type, org_id, project_id, environment_id, cluster_id, source_type, registry_config, networking, deployment_config, variables, is_cluster_entity, created_by, created_at, updated_at) VALUES
(
  'ctr-hk-explorer-fe-hanzo', 'ctr-hk-explorer-fe-hanzo', 'hk-explorer-fe-hanzo', 'lux-frontend-hanzo',
  'deployment', 'org-lux-001', 'prj-lux-hanzo-001', 'env-lux-explorer-hk',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/luxfi/lux-frontend","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":80,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-hk-explorer-fe-mainnet', 'ctr-hk-explorer-fe-mainnet', 'hk-explorer-fe-mainnet', 'lux-frontend-mainnet',
  'deployment', 'org-lux-001', 'prj-lux-hanzo-001', 'env-lux-explorer-hk',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/luxfi/lux-frontend","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":80,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-hk-explorer-fe-pars', 'ctr-hk-explorer-fe-pars', 'hk-explorer-fe-pars', 'lux-frontend-pars',
  'deployment', 'org-lux-001', 'prj-lux-hanzo-001', 'env-lux-explorer-hk',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/luxfi/lux-frontend","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":80,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-hk-explorer-fe-spc', 'ctr-hk-explorer-fe-spc', 'hk-explorer-fe-spc', 'lux-frontend-spc',
  'deployment', 'org-lux-001', 'prj-lux-hanzo-001', 'env-lux-explorer-hk',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/luxfi/lux-frontend","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":80,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-hk-explorer-fe-zoo', 'ctr-hk-explorer-fe-zoo', 'hk-explorer-fe-zoo', 'lux-frontend-zoo',
  'deployment', 'org-lux-001', 'prj-lux-hanzo-001', 'env-lux-explorer-hk',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/luxfi/lux-frontend","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":80,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Indexers (13 deployments)
INSERT INTO containers (id, iid, slug, name, type, org_id, project_id, environment_id, cluster_id, source_type, registry_config, networking, deployment_config, variables, is_cluster_entity, created_by, created_at, updated_at) VALUES
(
  'ctr-hk-explorer-idx-achain', 'ctr-hk-explorer-idx-achain', 'hk-explorer-idx-achain', 'lux-indexer-achain',
  'deployment', 'org-lux-001', 'prj-lux-hanzo-001', 'env-lux-explorer-hk',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/luxfi/lux-indexer","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":8080,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-hk-explorer-idx-bchain', 'ctr-hk-explorer-idx-bchain', 'hk-explorer-idx-bchain', 'lux-indexer-bchain',
  'deployment', 'org-lux-001', 'prj-lux-hanzo-001', 'env-lux-explorer-hk',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/luxfi/lux-indexer","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":8080,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-hk-explorer-idx-cchain', 'ctr-hk-explorer-idx-cchain', 'hk-explorer-idx-cchain', 'lux-indexer-cchain',
  'deployment', 'org-lux-001', 'prj-lux-hanzo-001', 'env-lux-explorer-hk',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/luxfi/lux-indexer","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":8080,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-hk-explorer-idx-hanzo', 'ctr-hk-explorer-idx-hanzo', 'hk-explorer-idx-hanzo', 'lux-indexer-hanzo',
  'deployment', 'org-lux-001', 'prj-lux-hanzo-001', 'env-lux-explorer-hk',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/luxfi/lux-indexer","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":8080,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-hk-explorer-idx-kchain', 'ctr-hk-explorer-idx-kchain', 'hk-explorer-idx-kchain', 'lux-indexer-kchain',
  'deployment', 'org-lux-001', 'prj-lux-hanzo-001', 'env-lux-explorer-hk',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/luxfi/lux-indexer","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":8080,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-hk-explorer-idx-pars', 'ctr-hk-explorer-idx-pars', 'hk-explorer-idx-pars', 'lux-indexer-pars',
  'deployment', 'org-lux-001', 'prj-lux-hanzo-001', 'env-lux-explorer-hk',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/luxfi/lux-indexer","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":8080,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-hk-explorer-idx-pchain', 'ctr-hk-explorer-idx-pchain', 'hk-explorer-idx-pchain', 'lux-indexer-pchain',
  'deployment', 'org-lux-001', 'prj-lux-hanzo-001', 'env-lux-explorer-hk',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/luxfi/lux-indexer","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":8080,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-hk-explorer-idx-qchain', 'ctr-hk-explorer-idx-qchain', 'hk-explorer-idx-qchain', 'lux-indexer-qchain',
  'deployment', 'org-lux-001', 'prj-lux-hanzo-001', 'env-lux-explorer-hk',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/luxfi/lux-indexer","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":8080,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-hk-explorer-idx-spc', 'ctr-hk-explorer-idx-spc', 'hk-explorer-idx-spc', 'lux-indexer-spc',
  'deployment', 'org-lux-001', 'prj-lux-hanzo-001', 'env-lux-explorer-hk',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/luxfi/lux-indexer","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":8080,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-hk-explorer-idx-tchain', 'ctr-hk-explorer-idx-tchain', 'hk-explorer-idx-tchain', 'lux-indexer-tchain',
  'deployment', 'org-lux-001', 'prj-lux-hanzo-001', 'env-lux-explorer-hk',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/luxfi/lux-indexer","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":8080,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-hk-explorer-idx-xchain', 'ctr-hk-explorer-idx-xchain', 'hk-explorer-idx-xchain', 'lux-indexer-xchain',
  'deployment', 'org-lux-001', 'prj-lux-hanzo-001', 'env-lux-explorer-hk',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/luxfi/lux-indexer","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":8080,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-hk-explorer-idx-zchain', 'ctr-hk-explorer-idx-zchain', 'hk-explorer-idx-zchain', 'lux-indexer-zchain',
  'deployment', 'org-lux-001', 'prj-lux-hanzo-001', 'env-lux-explorer-hk',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/luxfi/lux-indexer","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":8080,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-hk-explorer-idx-zoo', 'ctr-hk-explorer-idx-zoo', 'hk-explorer-idx-zoo', 'lux-indexer-zoo',
  'deployment', 'org-lux-001', 'prj-lux-hanzo-001', 'env-lux-explorer-hk',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/luxfi/lux-indexer","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":8080,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Explorer other services (5 deployments)
INSERT INTO containers (id, iid, slug, name, type, org_id, project_id, environment_id, cluster_id, source_type, registry_config, networking, deployment_config, variables, is_cluster_entity, created_by, created_at, updated_at) VALUES
(
  'ctr-hk-explorer-exchange', 'ctr-hk-explorer-exchange', 'hk-explorer-exchange', 'lux-exchange',
  'deployment', 'org-lux-001', 'prj-lux-hanzo-001', 'env-lux-explorer-hk',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/luxfi/lux-exchange","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":80,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-hk-explorer-sc-verifier', 'ctr-hk-explorer-sc-verifier', 'hk-explorer-sc-verifier', 'sc-verifier-mainnet',
  'deployment', 'org-lux-001', 'prj-lux-hanzo-001', 'env-lux-explorer-hk',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/luxfi/sc-verifier","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":8050,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-hk-explorer-sig-provider', 'ctr-hk-explorer-sig-provider', 'hk-explorer-sig-provider', 'sig-provider-mainnet',
  'deployment', 'org-lux-001', 'prj-lux-hanzo-001', 'env-lux-explorer-hk',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/luxfi/sig-provider","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":8043,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-hk-explorer-stats', 'ctr-hk-explorer-stats', 'hk-explorer-stats', 'stats-mainnet',
  'deployment', 'org-lux-001', 'prj-lux-hanzo-001', 'env-lux-explorer-hk',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/luxfi/stats","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":8050,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-hk-explorer-visualizer', 'ctr-hk-explorer-visualizer', 'hk-explorer-visualizer', 'visualizer-mainnet',
  'deployment', 'org-lux-001', 'prj-lux-hanzo-001', 'env-lux-explorer-hk',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/luxfi/visualizer","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":8050,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Explorer postgres instances (6 statefulsets)
INSERT INTO containers (id, iid, slug, name, type, org_id, project_id, environment_id, cluster_id, source_type, registry_config, networking, stateful_set_config, variables, is_cluster_entity, created_by, created_at, updated_at) VALUES
(
  'ctr-hk-explorer-pg-hanzo', 'ctr-hk-explorer-pg-hanzo', 'hk-explorer-pg-hanzo', 'blockscout-postgres-hanzo',
  'statefulset', 'org-lux-001', 'prj-lux-hanzo-001', 'env-lux-explorer-hk',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"postgres","tag":"15","registry_type":"Docker"}'::jsonb,
  '{"ports":[{"containerPort":5432,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-hk-explorer-pg-mainnet', 'ctr-hk-explorer-pg-mainnet', 'hk-explorer-pg-mainnet', 'blockscout-postgres-mainnet',
  'statefulset', 'org-lux-001', 'prj-lux-hanzo-001', 'env-lux-explorer-hk',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"postgres","tag":"15","registry_type":"Docker"}'::jsonb,
  '{"ports":[{"containerPort":5432,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-hk-explorer-pg-pars', 'ctr-hk-explorer-pg-pars', 'hk-explorer-pg-pars', 'blockscout-postgres-pars',
  'statefulset', 'org-lux-001', 'prj-lux-hanzo-001', 'env-lux-explorer-hk',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"postgres","tag":"15","registry_type":"Docker"}'::jsonb,
  '{"ports":[{"containerPort":5432,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-hk-explorer-pg-spc', 'ctr-hk-explorer-pg-spc', 'hk-explorer-pg-spc', 'blockscout-postgres-spc',
  'statefulset', 'org-lux-001', 'prj-lux-hanzo-001', 'env-lux-explorer-hk',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"postgres","tag":"15","registry_type":"Docker"}'::jsonb,
  '{"ports":[{"containerPort":5432,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-hk-explorer-pg-zoo', 'ctr-hk-explorer-pg-zoo', 'hk-explorer-pg-zoo', 'blockscout-postgres-zoo',
  'statefulset', 'org-lux-001', 'prj-lux-hanzo-001', 'env-lux-explorer-hk',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"postgres","tag":"15","registry_type":"Docker"}'::jsonb,
  '{"ports":[{"containerPort":5432,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-hk-explorer-pg-indexer', 'ctr-hk-explorer-pg-indexer', 'hk-explorer-pg-indexer', 'indexer-postgres',
  'statefulset', 'org-lux-001', 'prj-lux-hanzo-001', 'env-lux-explorer-hk',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"postgres","tag":"15","registry_type":"Docker"}'::jsonb,
  '{"ports":[{"containerPort":5432,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 5h. lux-gateway namespace on hanzo-k8s (1 service) — env-lux-gateway-hk
-- ---------------------------------------------------------------------
INSERT INTO containers (id, iid, slug, name, type, org_id, project_id, environment_id, cluster_id, source_type, registry_config, networking, deployment_config, variables, is_cluster_entity, created_by, created_at, updated_at) VALUES
(
  'ctr-hk-lux-gateway', 'ctr-hk-lux-gateway', 'hk-lux-gateway', 'gateway',
  'deployment', 'org-lux-001', 'prj-lux-hanzo-001', 'env-lux-gateway-hk',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/luxfi/api-gateway","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":8080,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":2}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 5i. lux-mainnet namespace on hanzo-k8s (2 services) — env-lux-mainnet-hk
-- ---------------------------------------------------------------------
INSERT INTO containers (id, iid, slug, name, type, org_id, project_id, environment_id, cluster_id, source_type, registry_config, networking, deployment_config, variables, is_cluster_entity, created_by, created_at, updated_at) VALUES
(
  'ctr-hk-lux-mainnet-gateway', 'ctr-hk-lux-mainnet-gateway', 'hk-lux-mainnet-gateway', 'api-gateway-gateway',
  'deployment', 'org-lux-001', 'prj-lux-hanzo-001', 'env-lux-mainnet-hk',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/luxfi/api-gateway","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":8080,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":2}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO containers (id, iid, slug, name, type, org_id, project_id, environment_id, cluster_id, source_type, registry_config, networking, stateful_set_config, variables, is_cluster_entity, created_by, created_at, updated_at) VALUES
(
  'ctr-hk-lux-mainnet-luxd', 'ctr-hk-lux-mainnet-luxd', 'hk-lux-mainnet-luxd', 'luxd',
  'statefulset', 'org-lux-001', 'prj-lux-hanzo-001', 'env-lux-mainnet-hk',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/luxfi/luxd","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":9650,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":5}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 5j. lux-mpc namespace on hanzo-k8s (4 services) — env-lux-mpc-hk
-- ---------------------------------------------------------------------
INSERT INTO containers (id, iid, slug, name, type, org_id, project_id, environment_id, cluster_id, source_type, registry_config, networking, deployment_config, variables, is_cluster_entity, created_by, created_at, updated_at) VALUES
(
  'ctr-hk-lux-mpc-dashboard', 'ctr-hk-lux-mpc-dashboard', 'hk-lux-mpc-dashboard', 'mpc-dashboard',
  'deployment', 'org-lux-001', 'prj-lux-hanzo-001', 'env-lux-mpc-hk',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/luxfi/mpc-dashboard","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":80,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO containers (id, iid, slug, name, type, org_id, project_id, environment_id, cluster_id, source_type, registry_config, networking, stateful_set_config, variables, is_cluster_entity, created_by, created_at, updated_at) VALUES
(
  'ctr-hk-lux-mpc-node', 'ctr-hk-lux-mpc-node', 'hk-lux-mpc-node', 'mpc-node',
  'statefulset', 'org-lux-001', 'prj-lux-hanzo-001', 'env-lux-mpc-hk',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/luxfi/mpc-node","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":8545,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":3}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-hk-lux-mpc-postgres', 'ctr-hk-lux-mpc-postgres', 'hk-lux-mpc-postgres', 'mpc-postgres',
  'statefulset', 'org-lux-001', 'prj-lux-hanzo-001', 'env-lux-mpc-hk',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"postgres","tag":"15","registry_type":"Docker"}'::jsonb,
  '{"ports":[{"containerPort":5432,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-hk-lux-mpc-valkey', 'ctr-hk-lux-mpc-valkey', 'hk-lux-mpc-valkey', 'mpc-valkey',
  'statefulset', 'org-lux-001', 'prj-lux-hanzo-001', 'env-lux-mpc-hk',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/hanzoai/kv","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":6379,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 5k. lux-system namespace on hanzo-k8s (1 service) — env-lux-system-hk
-- ---------------------------------------------------------------------
INSERT INTO containers (id, iid, slug, name, type, org_id, project_id, environment_id, cluster_id, source_type, registry_config, networking, deployment_config, variables, is_cluster_entity, created_by, created_at, updated_at) VALUES
(
  'ctr-hk-lux-system-operator', 'ctr-hk-lux-system-operator', 'hk-lux-system-operator', 'lux-operator',
  'deployment', 'org-lux-001', 'prj-lux-hanzo-001', 'env-lux-system-hk',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/luxfi/lux-operator","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":8080,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 5l. lux-testnet namespace on hanzo-k8s (2 services) — env-lux-testnet-hk
-- ---------------------------------------------------------------------
INSERT INTO containers (id, iid, slug, name, type, org_id, project_id, environment_id, cluster_id, source_type, registry_config, networking, deployment_config, variables, is_cluster_entity, created_by, created_at, updated_at) VALUES
(
  'ctr-hk-lux-testnet-gateway', 'ctr-hk-lux-testnet-gateway', 'hk-lux-testnet-gateway', 'api-gateway-gateway',
  'deployment', 'org-lux-001', 'prj-lux-hanzo-001', 'env-lux-testnet-hk',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/luxfi/api-gateway","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":8080,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO containers (id, iid, slug, name, type, org_id, project_id, environment_id, cluster_id, source_type, registry_config, networking, stateful_set_config, variables, is_cluster_entity, created_by, created_at, updated_at) VALUES
(
  'ctr-hk-lux-testnet-luxd', 'ctr-hk-lux-testnet-luxd', 'hk-lux-testnet-luxd', 'luxd',
  'statefulset', 'org-lux-001', 'prj-lux-hanzo-001', 'env-lux-testnet-hk',
  '1a153000-90a6-48ad-9375-7ef901a9bf7f', 'registry',
  '{"image":"ghcr.io/luxfi/luxd","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":9650,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":5}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;


-- =====================================================================
-- 6. CONTAINERS — lux-k8s (04c46df5-5986-429a-9c7f-3f11a81c8539)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 6a. lux-bridge namespace on lux-k8s (6 services) — env-lux-bridge
-- ---------------------------------------------------------------------
INSERT INTO containers (id, iid, slug, name, type, org_id, project_id, environment_id, cluster_id, source_type, registry_config, networking, deployment_config, variables, is_cluster_entity, created_by, created_at, updated_at) VALUES
(
  'ctr-lk-lux-bridge-server', 'ctr-lk-lux-bridge-server', 'lk-lux-bridge-server', 'bridge-server',
  'deployment', 'org-lux-001', 'prj-lux-infra-001', 'env-lux-bridge',
  '04c46df5-5986-429a-9c7f-3f11a81c8539', 'registry',
  '{"image":"ghcr.io/luxfi/bridge-server","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":3000,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":2}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-lk-lux-bridge-ui', 'ctr-lk-lux-bridge-ui', 'lk-lux-bridge-ui', 'bridge-ui',
  'deployment', 'org-lux-001', 'prj-lux-infra-001', 'env-lux-bridge',
  '04c46df5-5986-429a-9c7f-3f11a81c8539', 'registry',
  '{"image":"ghcr.io/luxfi/bridge-ui","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":80,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":2}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-lk-lux-bridge-nats', 'ctr-lk-lux-bridge-nats', 'lk-lux-bridge-nats', 'nats',
  'deployment', 'org-lux-001', 'prj-lux-infra-001', 'env-lux-bridge',
  '04c46df5-5986-429a-9c7f-3f11a81c8539', 'registry',
  '{"image":"nats","tag":"latest","registry_type":"Docker"}'::jsonb,
  '{"ports":[{"containerPort":4222,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO containers (id, iid, slug, name, type, org_id, project_id, environment_id, cluster_id, source_type, registry_config, networking, stateful_set_config, variables, is_cluster_entity, created_by, created_at, updated_at) VALUES
(
  'ctr-lk-lux-bridge-consul', 'ctr-lk-lux-bridge-consul', 'lk-lux-bridge-consul', 'consul',
  'statefulset', 'org-lux-001', 'prj-lux-infra-001', 'env-lux-bridge',
  '04c46df5-5986-429a-9c7f-3f11a81c8539', 'registry',
  '{"image":"hashicorp/consul","tag":"latest","registry_type":"Docker"}'::jsonb,
  '{"ports":[{"containerPort":8500,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-lk-lux-bridge-mpc-node', 'ctr-lk-lux-bridge-mpc-node', 'lk-lux-bridge-mpc-node', 'mpc-node',
  'statefulset', 'org-lux-001', 'prj-lux-infra-001', 'env-lux-bridge',
  '04c46df5-5986-429a-9c7f-3f11a81c8539', 'registry',
  '{"image":"ghcr.io/luxfi/mpc-node","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":8545,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":5}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-lk-lux-bridge-postgres', 'ctr-lk-lux-bridge-postgres', 'lk-lux-bridge-postgres', 'postgres',
  'statefulset', 'org-lux-001', 'prj-lux-infra-001', 'env-lux-bridge',
  '04c46df5-5986-429a-9c7f-3f11a81c8539', 'registry',
  '{"image":"postgres","tag":"15","registry_type":"Docker"}'::jsonb,
  '{"ports":[{"containerPort":5432,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 6b. lux-explorer namespace on lux-k8s (13 services) — env-lux-explorer
-- ---------------------------------------------------------------------

-- Blockscout instances (3 deployments)
INSERT INTO containers (id, iid, slug, name, type, org_id, project_id, environment_id, cluster_id, source_type, registry_config, networking, deployment_config, variables, is_cluster_entity, created_by, created_at, updated_at) VALUES
(
  'ctr-lk-explorer-bs-devnet', 'ctr-lk-explorer-bs-devnet', 'lk-explorer-bs-devnet', 'blockscout-devnet',
  'deployment', 'org-lux-001', 'prj-lux-infra-001', 'env-lux-explorer',
  '04c46df5-5986-429a-9c7f-3f11a81c8539', 'registry',
  '{"image":"ghcr.io/luxfi/blockscout","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":4000,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-lk-explorer-bs-mainnet', 'ctr-lk-explorer-bs-mainnet', 'lk-explorer-bs-mainnet', 'blockscout-mainnet',
  'deployment', 'org-lux-001', 'prj-lux-infra-001', 'env-lux-explorer',
  '04c46df5-5986-429a-9c7f-3f11a81c8539', 'registry',
  '{"image":"ghcr.io/luxfi/blockscout","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":4000,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-lk-explorer-bs-testnet', 'ctr-lk-explorer-bs-testnet', 'lk-explorer-bs-testnet', 'blockscout-testnet',
  'deployment', 'org-lux-001', 'prj-lux-infra-001', 'env-lux-explorer',
  '04c46df5-5986-429a-9c7f-3f11a81c8539', 'registry',
  '{"image":"ghcr.io/luxfi/blockscout","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":4000,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Frontends (3 deployments)
INSERT INTO containers (id, iid, slug, name, type, org_id, project_id, environment_id, cluster_id, source_type, registry_config, networking, deployment_config, variables, is_cluster_entity, created_by, created_at, updated_at) VALUES
(
  'ctr-lk-explorer-fe-devnet', 'ctr-lk-explorer-fe-devnet', 'lk-explorer-fe-devnet', 'lux-frontend-devnet',
  'deployment', 'org-lux-001', 'prj-lux-infra-001', 'env-lux-explorer',
  '04c46df5-5986-429a-9c7f-3f11a81c8539', 'registry',
  '{"image":"ghcr.io/luxfi/lux-frontend","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":80,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-lk-explorer-fe-mainnet', 'ctr-lk-explorer-fe-mainnet', 'lk-explorer-fe-mainnet', 'lux-frontend-mainnet',
  'deployment', 'org-lux-001', 'prj-lux-infra-001', 'env-lux-explorer',
  '04c46df5-5986-429a-9c7f-3f11a81c8539', 'registry',
  '{"image":"ghcr.io/luxfi/lux-frontend","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":80,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-lk-explorer-fe-testnet', 'ctr-lk-explorer-fe-testnet', 'lk-explorer-fe-testnet', 'lux-frontend-testnet',
  'deployment', 'org-lux-001', 'prj-lux-infra-001', 'env-lux-explorer',
  '04c46df5-5986-429a-9c7f-3f11a81c8539', 'registry',
  '{"image":"ghcr.io/luxfi/lux-frontend","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":80,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Explorer utilities (4 deployments)
INSERT INTO containers (id, iid, slug, name, type, org_id, project_id, environment_id, cluster_id, source_type, registry_config, networking, deployment_config, variables, is_cluster_entity, created_by, created_at, updated_at) VALUES
(
  'ctr-lk-explorer-sc-verifier', 'ctr-lk-explorer-sc-verifier', 'lk-explorer-sc-verifier', 'sc-verifier-mainnet',
  'deployment', 'org-lux-001', 'prj-lux-infra-001', 'env-lux-explorer',
  '04c46df5-5986-429a-9c7f-3f11a81c8539', 'registry',
  '{"image":"ghcr.io/luxfi/sc-verifier","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":8050,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-lk-explorer-sig-provider', 'ctr-lk-explorer-sig-provider', 'lk-explorer-sig-provider', 'sig-provider-mainnet',
  'deployment', 'org-lux-001', 'prj-lux-infra-001', 'env-lux-explorer',
  '04c46df5-5986-429a-9c7f-3f11a81c8539', 'registry',
  '{"image":"ghcr.io/luxfi/sig-provider","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":8043,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-lk-explorer-stats', 'ctr-lk-explorer-stats', 'lk-explorer-stats', 'stats-mainnet',
  'deployment', 'org-lux-001', 'prj-lux-infra-001', 'env-lux-explorer',
  '04c46df5-5986-429a-9c7f-3f11a81c8539', 'registry',
  '{"image":"ghcr.io/luxfi/stats","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":8050,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-lk-explorer-visualizer', 'ctr-lk-explorer-visualizer', 'lk-explorer-visualizer', 'visualizer-mainnet',
  'deployment', 'org-lux-001', 'prj-lux-infra-001', 'env-lux-explorer',
  '04c46df5-5986-429a-9c7f-3f11a81c8539', 'registry',
  '{"image":"ghcr.io/luxfi/visualizer","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":8050,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Explorer postgres instances on lux-k8s (3 statefulsets)
INSERT INTO containers (id, iid, slug, name, type, org_id, project_id, environment_id, cluster_id, source_type, registry_config, networking, stateful_set_config, variables, is_cluster_entity, created_by, created_at, updated_at) VALUES
(
  'ctr-lk-explorer-pg-devnet', 'ctr-lk-explorer-pg-devnet', 'lk-explorer-pg-devnet', 'blockscout-postgres-devnet',
  'statefulset', 'org-lux-001', 'prj-lux-infra-001', 'env-lux-explorer',
  '04c46df5-5986-429a-9c7f-3f11a81c8539', 'registry',
  '{"image":"postgres","tag":"15","registry_type":"Docker"}'::jsonb,
  '{"ports":[{"containerPort":5432,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-lk-explorer-pg-mainnet', 'ctr-lk-explorer-pg-mainnet', 'lk-explorer-pg-mainnet', 'blockscout-postgres-mainnet',
  'statefulset', 'org-lux-001', 'prj-lux-infra-001', 'env-lux-explorer',
  '04c46df5-5986-429a-9c7f-3f11a81c8539', 'registry',
  '{"image":"postgres","tag":"15","registry_type":"Docker"}'::jsonb,
  '{"ports":[{"containerPort":5432,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-lk-explorer-pg-testnet', 'ctr-lk-explorer-pg-testnet', 'lk-explorer-pg-testnet', 'blockscout-postgres-testnet',
  'statefulset', 'org-lux-001', 'prj-lux-infra-001', 'env-lux-explorer',
  '04c46df5-5986-429a-9c7f-3f11a81c8539', 'registry',
  '{"image":"postgres","tag":"15","registry_type":"Docker"}'::jsonb,
  '{"ports":[{"containerPort":5432,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 6c. lux-gateway namespace on lux-k8s (4 services) — env-lux-gateway
-- ---------------------------------------------------------------------
INSERT INTO containers (id, iid, slug, name, type, org_id, project_id, environment_id, cluster_id, source_type, registry_config, networking, deployment_config, variables, is_cluster_entity, created_by, created_at, updated_at) VALUES
(
  'ctr-lk-lux-gateway', 'ctr-lk-lux-gateway', 'lk-lux-gateway', 'gateway',
  'deployment', 'org-lux-001', 'prj-lux-infra-001', 'env-lux-gateway',
  '04c46df5-5986-429a-9c7f-3f11a81c8539', 'registry',
  '{"image":"ghcr.io/luxfi/api-gateway","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":8080,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":2}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-lk-lux-gateway-devnet', 'ctr-lk-lux-gateway-devnet', 'lk-lux-gateway-devnet', 'gateway-devnet',
  'deployment', 'org-lux-001', 'prj-lux-infra-001', 'env-lux-gateway',
  '04c46df5-5986-429a-9c7f-3f11a81c8539', 'registry',
  '{"image":"ghcr.io/luxfi/api-gateway","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":8080,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":2}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-lk-lux-gateway-mainnet', 'ctr-lk-lux-gateway-mainnet', 'lk-lux-gateway-mainnet', 'gateway-mainnet',
  'deployment', 'org-lux-001', 'prj-lux-infra-001', 'env-lux-gateway',
  '04c46df5-5986-429a-9c7f-3f11a81c8539', 'registry',
  '{"image":"ghcr.io/luxfi/api-gateway","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":8080,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":2}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-lk-lux-gateway-testnet', 'ctr-lk-lux-gateway-testnet', 'lk-lux-gateway-testnet', 'gateway-testnet',
  'deployment', 'org-lux-001', 'prj-lux-infra-001', 'env-lux-gateway',
  '04c46df5-5986-429a-9c7f-3f11a81c8539', 'registry',
  '{"image":"ghcr.io/luxfi/api-gateway","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":8080,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":2}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 6d. lux-mpc namespace on lux-k8s (3 services) — env-lux-mpc
-- ---------------------------------------------------------------------
INSERT INTO containers (id, iid, slug, name, type, org_id, project_id, environment_id, cluster_id, source_type, registry_config, networking, deployment_config, variables, is_cluster_entity, created_by, created_at, updated_at) VALUES
(
  'ctr-lk-lux-mpc-api', 'ctr-lk-lux-mpc-api', 'lk-lux-mpc-api', 'mpc-api',
  'deployment', 'org-lux-001', 'prj-lux-infra-001', 'env-lux-mpc',
  '04c46df5-5986-429a-9c7f-3f11a81c8539', 'registry',
  '{"image":"ghcr.io/luxfi/mpc-api","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":8080,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-lk-lux-mpc-dashboard', 'ctr-lk-lux-mpc-dashboard', 'lk-lux-mpc-dashboard', 'mpc-dashboard',
  'deployment', 'org-lux-001', 'prj-lux-infra-001', 'env-lux-mpc',
  '04c46df5-5986-429a-9c7f-3f11a81c8539', 'registry',
  '{"image":"ghcr.io/luxfi/mpc-dashboard","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":80,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO containers (id, iid, slug, name, type, org_id, project_id, environment_id, cluster_id, source_type, registry_config, networking, stateful_set_config, variables, is_cluster_entity, created_by, created_at, updated_at) VALUES
(
  'ctr-lk-lux-mpc-postgres', 'ctr-lk-lux-mpc-postgres', 'lk-lux-mpc-postgres', 'mpc-postgres',
  'statefulset', 'org-lux-001', 'prj-lux-infra-001', 'env-lux-mpc',
  '04c46df5-5986-429a-9c7f-3f11a81c8539', 'registry',
  '{"image":"postgres","tag":"15","registry_type":"Docker"}'::jsonb,
  '{"ports":[{"containerPort":5432,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 6e. lux-system namespace on lux-k8s (2 services) — env-lux-system
-- ---------------------------------------------------------------------
INSERT INTO containers (id, iid, slug, name, type, org_id, project_id, environment_id, cluster_id, source_type, registry_config, networking, deployment_config, variables, is_cluster_entity, created_by, created_at, updated_at) VALUES
(
  'ctr-lk-lux-system-operator', 'ctr-lk-lux-system-operator', 'lk-lux-system-operator', 'lux-operator',
  'deployment', 'org-lux-001', 'prj-lux-infra-001', 'env-lux-system',
  '04c46df5-5986-429a-9c7f-3f11a81c8539', 'registry',
  '{"image":"ghcr.io/luxfi/lux-operator","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":8080,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
),
(
  'ctr-lk-lux-system-status', 'ctr-lk-lux-system-status', 'lk-lux-system-status', 'status',
  'deployment', 'org-lux-001', 'prj-lux-infra-001', 'env-lux-system',
  '04c46df5-5986-429a-9c7f-3f11a81c8539', 'registry',
  '{"image":"ghcr.io/luxfi/status","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":80,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 6f. lux-devnet namespace on lux-k8s (1 service) — env-lux-devnet
-- ---------------------------------------------------------------------
INSERT INTO containers (id, iid, slug, name, type, org_id, project_id, environment_id, cluster_id, source_type, registry_config, networking, stateful_set_config, variables, is_cluster_entity, created_by, created_at, updated_at) VALUES
(
  'ctr-lk-lux-devnet-luxd', 'ctr-lk-lux-devnet-luxd', 'lk-lux-devnet-luxd', 'luxd',
  'statefulset', 'org-lux-001', 'prj-lux-infra-001', 'env-lux-devnet',
  '04c46df5-5986-429a-9c7f-3f11a81c8539', 'registry',
  '{"image":"ghcr.io/luxfi/luxd","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":9650,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":5}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 6g. lux-mainnet namespace on lux-k8s (1 service) — env-lux-mainnet
-- ---------------------------------------------------------------------
INSERT INTO containers (id, iid, slug, name, type, org_id, project_id, environment_id, cluster_id, source_type, registry_config, networking, stateful_set_config, variables, is_cluster_entity, created_by, created_at, updated_at) VALUES
(
  'ctr-lk-lux-mainnet-luxd', 'ctr-lk-lux-mainnet-luxd', 'lk-lux-mainnet-luxd', 'luxd',
  'statefulset', 'org-lux-001', 'prj-lux-infra-001', 'env-lux-mainnet',
  '04c46df5-5986-429a-9c7f-3f11a81c8539', 'registry',
  '{"image":"ghcr.io/luxfi/luxd","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":9650,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":5}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 6h. lux-testnet namespace on lux-k8s (1 service) — env-lux-testnet
-- ---------------------------------------------------------------------
INSERT INTO containers (id, iid, slug, name, type, org_id, project_id, environment_id, cluster_id, source_type, registry_config, networking, stateful_set_config, variables, is_cluster_entity, created_by, created_at, updated_at) VALUES
(
  'ctr-lk-lux-testnet-luxd', 'ctr-lk-lux-testnet-luxd', 'lk-lux-testnet-luxd', 'luxd',
  'statefulset', 'org-lux-001', 'prj-lux-infra-001', 'env-lux-testnet',
  '04c46df5-5986-429a-9c7f-3f11a81c8539', 'registry',
  '{"image":"ghcr.io/luxfi/luxd","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":9650,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":5}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 6i. zoo namespace on lux-k8s (1 service) — env-lux-zoo
-- ---------------------------------------------------------------------
INSERT INTO containers (id, iid, slug, name, type, org_id, project_id, environment_id, cluster_id, source_type, registry_config, networking, deployment_config, variables, is_cluster_entity, created_by, created_at, updated_at) VALUES
(
  'ctr-lk-zoo-status', 'ctr-lk-zoo-status', 'lk-zoo-status', 'status',
  'deployment', 'org-lux-001', 'prj-lux-infra-001', 'env-lux-zoo',
  '04c46df5-5986-429a-9c7f-3f11a81c8539', 'registry',
  '{"image":"ghcr.io/luxfi/status","tag":"latest","registry_type":"GHCR"}'::jsonb,
  '{"ports":[{"containerPort":80,"protocol":"TCP"}]}'::jsonb,
  '{"replicas":1}'::jsonb,
  '[]'::jsonb, true, 'usr-hanzo-admin-001', NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;


-- =====================================================================
-- 7. VERIFICATION QUERIES (run after insert to confirm counts)
-- =====================================================================

-- Show totals by table
SELECT 'organizations' AS entity, COUNT(*) AS total FROM organizations
UNION ALL
SELECT 'org_members', COUNT(*) FROM org_members
UNION ALL
SELECT 'projects', COUNT(*) FROM projects
UNION ALL
SELECT 'environments', COUNT(*) FROM environments
UNION ALL
SELECT 'clusters', COUNT(*) FROM clusters
UNION ALL
SELECT 'containers', COUNT(*) FROM containers;

-- Show container counts per environment
SELECT e.name AS environment, e.id, COUNT(c.id) AS containers
FROM environments e
LEFT JOIN containers c ON c.environment_id = e.id
GROUP BY e.id, e.name
ORDER BY e.name;

COMMIT;
