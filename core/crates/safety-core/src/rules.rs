use crate::types::Limitation;
use serde::Deserialize;
use std::collections::BTreeMap;

const THIRTY_DAYS_MS: u64 = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_GENERATED_AT_MS: u64 = 1_783_382_400_000; // 2026-07-01T00:00:00Z

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RulePackage {
    #[serde(default = "default_version")]
    pub version: String,
    #[serde(default = "default_generated_at_ms")]
    pub generated_at_ms: u64,
    #[serde(default = "default_shorteners")]
    pub shortener_hosts: Vec<String>,
    #[serde(default = "default_brands")]
    pub brands: Vec<BrandRule>,
    #[serde(default = "default_suspicious_tlds")]
    pub suspicious_tlds: Vec<String>,
    #[serde(default = "default_malicious")]
    pub known_malicious: Vec<MaliciousRule>,
    #[serde(default = "default_premium_prefixes")]
    pub premium_rate_prefixes: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrandRule {
    pub name: String,
    #[serde(default)]
    pub allowed_domains: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MaliciousRule {
    pub id: String,
    #[serde(default)]
    pub host: Option<String>,
    #[serde(default)]
    pub contains: Option<String>,
}

impl RulePackage {
    pub fn bundled() -> Self {
        Self {
            version: default_version(),
            generated_at_ms: default_generated_at_ms(),
            shortener_hosts: default_shorteners(),
            brands: default_brands(),
            suspicious_tlds: default_suspicious_tlds(),
            known_malicious: default_malicious(),
            premium_rate_prefixes: default_premium_prefixes(),
        }
    }

    pub fn from_config(value: Option<serde_json::Value>) -> (Self, Vec<Limitation>) {
        match value {
            Some(v) => serde_json::from_value::<Self>(v).map_or_else(
                |_| {
                    (
                        Self::bundled(),
                        vec![Limitation::new(
                            "limitation.rules_unavailable",
                            BTreeMap::new(),
                        )],
                    )
                },
                |rules| (rules.normalized(), Vec::new()),
            ),
            None => (Self::bundled(), Vec::new()),
        }
    }

    pub fn freshness_limitations(&self, now_ms: u64) -> Vec<Limitation> {
        if now_ms.saturating_sub(self.generated_at_ms) > THIRTY_DAYS_MS {
            let age_days = now_ms.saturating_sub(self.generated_at_ms) / (24 * 60 * 60 * 1000);
            return vec![Limitation::new(
                "limitation.rules_stale",
                BTreeMap::from([("ageDays".to_owned(), age_days.to_string())]),
            )];
        }
        Vec::new()
    }

    fn normalized(mut self) -> Self {
        self.shortener_hosts = lower_vec(self.shortener_hosts);
        self.suspicious_tlds = lower_vec(self.suspicious_tlds);
        self.premium_rate_prefixes = lower_vec(self.premium_rate_prefixes);
        for brand in &mut self.brands {
            brand.allowed_domains = lower_vec(std::mem::take(&mut brand.allowed_domains));
        }
        self
    }

    pub fn brand_for_text<'a>(&'a self, text: &str) -> Option<&'a BrandRule> {
        let folded = fold_token(text);
        self.brands.iter().find(|brand| {
            let brand_token = fold_token(&brand.name);
            !brand_token.is_empty() && folded.contains(&brand_token)
        })
    }

    pub fn is_allowed_brand_domain(&self, brand: &BrandRule, registrable_domain: &str) -> bool {
        let domain = registrable_domain.to_lowercase();
        brand
            .allowed_domains
            .iter()
            .any(|allowed| allowed == &domain || domain.ends_with(&format!(".{allowed}")))
    }
}

fn default_version() -> String {
    "bundled-2026-07-01".to_owned()
}

fn default_generated_at_ms() -> u64 {
    DEFAULT_GENERATED_AT_MS
}

fn default_shorteners() -> Vec<String> {
    [
        "bit.ly",
        "t.co",
        "tinyurl.com",
        "goo.gl",
        "ow.ly",
        "is.gd",
        "buff.ly",
        "rebrand.ly",
        "cutt.ly",
        "shorturl.at",
        "lnkd.in",
        "qrco.de",
        "rb.gy",
    ]
    .iter()
    .map(|s| (*s).to_owned())
    .collect()
}

fn default_brands() -> Vec<BrandRule> {
    let items: &[(&str, &[&str])] = &[
        ("DNB", &["dnb.no"]),
        ("Vipps", &["vipps.no"]),
        ("Posten", &["posten.no"]),
        ("PostNord", &["postnord.no"]),
        ("Skatteetaten", &["skatteetaten.no"]),
        ("Altinn", &["altinn.no"]),
        ("BankID", &["bankid.no"]),
        ("Helsenorge", &["helsenorge.no"]),
        ("NAV", &["nav.no"]),
        ("Telenor", &["telenor.no"]),
        ("Telia", &["telia.no"]),
        ("Elkjøp", &["elkjop.no", "elkjøp.no"]),
        ("Ruter", &["ruter.no"]),
        ("SpareBank 1", &["sparebank1.no"]),
        ("Nordea", &["nordea.no"]),
        ("PayPal", &["paypal.com"]),
        ("Apple", &["apple.com"]),
        ("Microsoft", &["microsoft.com"]),
    ];
    items
        .iter()
        .map(|(name, domains)| BrandRule {
            name: (*name).to_owned(),
            allowed_domains: domains.iter().map(|d| (*d).to_owned()).collect(),
        })
        .collect()
}

fn default_suspicious_tlds() -> Vec<String> {
    [
        "zip", "mov", "top", "xyz", "click", "country", "gq", "tk", "ml", "cf",
    ]
    .iter()
    .map(|s| (*s).to_owned())
    .collect()
}

fn default_malicious() -> Vec<MaliciousRule> {
    vec![MaliciousRule {
        id: "bundled-malicious-example".to_owned(),
        host: Some("malicious.example".to_owned()),
        contains: None,
    }]
}

fn default_premium_prefixes() -> Vec<String> {
    ["820", "829", "85", "0900", "1900"]
        .iter()
        .map(|s| (*s).to_owned())
        .collect()
}

fn lower_vec(items: Vec<String>) -> Vec<String> {
    items.into_iter().map(|s| s.to_lowercase()).collect()
}

pub fn fold_token(value: &str) -> String {
    value
        .chars()
        .filter(|ch| ch.is_alphanumeric())
        .flat_map(char::to_lowercase)
        .collect()
}
