import axios from "axios";

const DO_API = "https://api.digitalocean.com/v2";
const doHeaders = () => ({
	Authorization: `Bearer ${process.env.DO_API_TOKEN}`,
	"Content-Type": "application/json",
});

// Cache for 1 hour
let plansCache = null;
let plansCacheTs = 0;
let regionsCache = null;
let regionsCacheTs = 0;
const CACHE_TTL = 60 * 60 * 1000;

// Markup percentage (env-configurable, default 20%)
const MARKUP_PERCENT = parseFloat(process.env.PAAS_MARKUP_PERCENT || "20");

// Plan tiers — map DO size slugs to user-friendly plan names
const PLAN_TIERS = [
	{
		id: "starter",
		name: "Starter",
		slug: "s-1vcpu-1gb",
		description: "Perfect for development and testing",
		cpuType: "Shared",
		maxVMs: 3,
		freeTier: true,
		popular: false,
		features: [
			"1 vCPU (shared)",
			"1 GB RAM",
			"25 GB SSD",
			"1 TB transfer",
			"$5 free credit",
		],
	},
	{
		id: "basic",
		name: "Basic",
		slug: "s-1vcpu-2gb",
		description: "Small apps and services",
		cpuType: "Shared",
		maxVMs: 5,
		freeTier: false,
		popular: false,
		features: [
			"1 vCPU (shared)",
			"2 GB RAM",
			"50 GB SSD",
			"2 TB transfer",
		],
	},
	{
		id: "standard",
		name: "Standard",
		slug: "s-2vcpu-4gb",
		description: "Production workloads and APIs",
		cpuType: "Shared",
		maxVMs: 10,
		freeTier: false,
		popular: true,
		features: [
			"2 vCPUs (shared)",
			"4 GB RAM",
			"80 GB SSD",
			"4 TB transfer",
			"Automated backups",
		],
	},
	{
		id: "performance",
		name: "Performance",
		slug: "s-4vcpu-8gb",
		description: "High-traffic apps and databases",
		cpuType: "Shared",
		maxVMs: 20,
		freeTier: false,
		popular: false,
		features: [
			"4 vCPUs (shared)",
			"8 GB RAM",
			"160 GB SSD",
			"5 TB transfer",
			"Automated backups",
			"Priority support",
		],
	},
	{
		id: "pro",
		name: "Professional",
		slug: "s-8vcpu-16gb-amd",
		description: "Dedicated compute for demanding workloads",
		cpuType: "AMD",
		maxVMs: 50,
		freeTier: false,
		popular: false,
		features: [
			"8 vCPUs (AMD dedicated)",
			"16 GB RAM",
			"320 GB NVMe SSD",
			"6 TB transfer",
			"Automated backups",
			"Priority support",
			"99.99% SLA",
		],
	},
	{
		id: "enterprise",
		name: "Enterprise",
		slug: "c-16-intel",
		description: "Maximum performance for enterprise",
		cpuType: "Intel Dedicated",
		maxVMs: 100,
		freeTier: false,
		popular: false,
		features: [
			"16 vCPUs (Intel dedicated)",
			"32 GB RAM",
			"500 GB NVMe SSD",
			"8 TB transfer",
			"Automated backups",
			"Dedicated support",
			"99.99% SLA",
			"Custom networking",
		],
	},
];

/**
 * Get cloud VM plans with real pricing from DigitalOcean.
 * Applies markup and caches results.
 */
export async function getCloudPlans() {
	if (plansCache && Date.now() - plansCacheTs < CACHE_TTL) {
		return plansCache;
	}

	// Fetch all available sizes from DO
	const res = await axios.get(`${DO_API}/sizes?per_page=200`, {
		headers: doHeaders(),
	});
	const doSizes = res.data.sizes;

	// Map plan tiers to real DO pricing
	const plans = PLAN_TIERS.map((tier) => {
		const doSize = doSizes.find((s) => s.slug === tier.slug);

		if (doSize) {
			// Real pricing with markup
			const baseMonthly = doSize.price_monthly;
			const baseHourly = doSize.price_hourly;
			const monthly = Math.round(baseMonthly * (1 + MARKUP_PERCENT / 100) * 100) / 100;
			const hourly = Math.round(baseHourly * (1 + MARKUP_PERCENT / 100) * 100000) / 100000;

			return {
				id: tier.id,
				name: tier.name,
				description: tier.description,
				vcpus: doSize.vcpus,
				memoryGB: Math.round(doSize.memory / 1024),
				diskGB: doSize.disk,
				cpuType: tier.cpuType,
				maxVMs: tier.maxVMs,
				priceMonthly: monthly,
				priceHourly: hourly,
				freeTier: tier.freeTier,
				popular: tier.popular,
				features: tier.features,
				doSlug: tier.slug,
			};
		}

		// Fallback: size not available in this DO account
		return null;
	}).filter(Boolean);

	plansCache = plans;
	plansCacheTs = Date.now();
	return plans;
}

/**
 * Get available deployment regions from DigitalOcean.
 */
export async function getCloudRegions() {
	if (regionsCache && Date.now() - regionsCacheTs < CACHE_TTL) {
		return regionsCache;
	}

	const res = await axios.get(`${DO_API}/regions`, {
		headers: doHeaders(),
	});

	const regions = res.data.regions
		.filter((r) => r.available && r.features.includes("kubernetes"))
		.map((r) => ({
			id: r.slug,
			name: r.name,
			location: `${r.name}`,
			available: r.available,
		}));

	regionsCache = regions;
	regionsCacheTs = Date.now();
	return regions;
}
