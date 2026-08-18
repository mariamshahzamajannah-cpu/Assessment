#!/usr/bin/env python3
"""
Seed loader for the Claims Ring app's CognoDB instance.

Creates a realistic-looking book of Members, Providers, Policies, and Claims,
plus a handful of Address / BankAccount / Phone "identity" nodes that are
deliberately shared by 3+ members who all filed against the same provider --
i.e. the fraud rings the /api/fraud-rings endpoint is built to surface.

Usage:
    pip install -r requirements.txt
    export COGNODB_URI=bolt+s://db-b6fc760e.databases.cognodb.com
    export COGNODB_USER=cognodb
    export COGNODB_PASSWORD=8c70c871ef848f31597206b4c3d43e61
    python3 seedfile.py

Safe to re-run: every write uses MERGE keyed on a stable id, so running this
twice updates in place instead of duplicating data. Pass --reset to wipe the
whole graph first.
"""

import argparse
import os
import random
import sys
from datetime import date, timedelta

from neo4j import GraphDatabase

random.seed(42)  # reproducible seed data across runs

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

URI = os.environ.get("COGNODB_URI")
USER = os.environ.get("COGNODB_USER", "cognodb")
PASSWORD = os.environ.get("COGNODB_PASSWORD")

FIRST_NAMES = [
    "James", "Maria", "Robert", "Linda", "Michael", "Patricia", "David", "Barbara",
    "Richard", "Jennifer", "Joseph", "Susan", "Thomas", "Karen", "Charles", "Nancy",
    "Daniel", "Lisa", "Matthew", "Betty", "Anthony", "Sandra", "Mark", "Ashley",
    "Paul", "Kimberly", "Steven", "Emily", "Andrew", "Donna", "Kenneth", "Michelle",
    "George", "Carol", "Edward", "Amanda", "Brian", "Melissa", "Ronald", "Deborah",
]
LAST_NAMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
    "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
    "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson",
    "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson",
]
STREETS = [
    "Maple Ave", "Oak St", "Cedar Ln", "Pine Rd", "Elm St", "Willow Way",
    "Birch Ct", "Sunset Blvd", "Lakeview Dr", "Highland Ave", "River Rd",
    "Chestnut St", "Magnolia Dr", "Franklin Ave", "Grove St",
]
CITIES = [
    ("Springfield", "62704"), ("Riverside", "92501"), ("Fairview", "30144"),
    ("Georgetown", "78626"), ("Clinton", "52732"), ("Madison", "53703"),
    ("Arlington", "22201"), ("Ashland", "97520"),
]
SPECIALTIES = [
    "Physical Therapy", "Chiropractic", "Orthopedics", "Dermatology",
    "Cardiology", "Primary Care", "Pain Management", "Radiology",
    "Podiatry", "Behavioral Health", "Urgent Care", "Dental",
]
DIAGNOSIS_CODES = ["M54.5", "S13.4", "M25.561", "R51.9", "M79.1", "S93.401A", "M17.11", "G89.29"]
CLAIM_STATUSES = ["submitted", "approved", "denied", "under_review", "paid"]
POLICY_TYPES = ["PPO", "HMO", "EPO", "HDHP"]


def rand_date(start: date, end: date) -> str:
    delta = (end - start).days
    return (start + timedelta(days=random.randint(0, max(delta, 0)))).isoformat()


def gen_ssn_last4() -> str:
    return f"{random.randint(0, 9999):04d}"


def gen_phone() -> str:
    return f"{random.randint(200, 999)}-{random.randint(200, 999)}-{random.randint(1000, 9999)}"


def gen_bank_last4() -> str:
    return f"{random.randint(0, 9999):04d}"


class Seeder:
    def __init__(self, driver):
        self.driver = driver
        self.members = []     # list of dicts
        self.providers = []
        self.claim_counter = 0
        self.policy_counter = 0

    # -- schema-ish helpers ------------------------------------------------

    def ensure_constraints(self):
        stmts = [
            "CREATE CONSTRAINT member_id IF NOT EXISTS FOR (m:Member) REQUIRE m.id IS UNIQUE",
            "CREATE CONSTRAINT provider_id IF NOT EXISTS FOR (p:Provider) REQUIRE p.id IS UNIQUE",
            "CREATE CONSTRAINT claim_id IF NOT EXISTS FOR (c:Claim) REQUIRE c.id IS UNIQUE",
            "CREATE CONSTRAINT policy_id IF NOT EXISTS FOR (pol:Policy) REQUIRE pol.id IS UNIQUE",
        ]
        with self.driver.session() as session:
            for stmt in stmts:
                try:
                    session.run(stmt)
                except Exception as exc:  # pragma: no cover - best effort on free tier
                    print(f"  (skipping constraint, not critical: {exc})", file=sys.stderr)

    def reset(self):
        with self.driver.session() as session:
            session.run("MATCH (n) DETACH DELETE n")

    # -- entity creation -----------------------------------------------------

    def create_providers(self, n=12):
        with self.driver.session() as session:
            for i in range(1, n + 1):
                pid = f"PRV-{i:03d}"
                specialty = SPECIALTIES[(i - 1) % len(SPECIALTIES)]
                provider = {
                    "id": pid,
                    "name": f"{random.choice(LAST_NAMES)} {specialty} Clinic",
                    "npi": f"{random.randint(1_000_000_000, 1_999_999_999)}",
                    "specialty": specialty,
                }
                session.run(
                    """
                    MERGE (p:Provider {id: $id})
                    SET p.name = $name, p.npi = $npi, p.specialty = $specialty
                    """,
                    provider,
                )
                self.providers.append(provider)
        print(f"Seeded {len(self.providers)} providers")

    def create_members(self, n=45):
        with self.driver.session() as session:
            for i in range(1, n + 1):
                mid = f"MEM-{i:04d}"
                member = {
                    "id": mid,
                    "name": f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}",
                    "dob": rand_date(date(1950, 1, 1), date(2002, 12, 31)),
                    "ssn": gen_ssn_last4(),
                    "createdAt": rand_date(date(2022, 1, 1), date(2024, 6, 1)),
                }
                session.run(
                    """
                    MERGE (m:Member {id: $id})
                    SET m.name = $name, m.dob = $dob, m.ssn = $ssn, m.createdAt = $createdAt
                    """,
                    member,
                )
                self.members.append(member)
        print(f"Seeded {len(self.members)} members")

    def create_policies_and_claims(self):
        with self.driver.session() as session:
            for member in self.members:
                # 1-2 policies per member
                for _ in range(random.randint(1, 2)):
                    self.policy_counter += 1
                    policy = {
                        "id": f"POL-{self.policy_counter:04d}",
                        "type": random.choice(POLICY_TYPES),
                        "startDate": rand_date(date(2021, 1, 1), date(2024, 1, 1)),
                        "premiumMonthly": round(random.uniform(180, 620), 2),
                        "status": random.choice(["active", "active", "active", "lapsed"]),
                        "memberId": member["id"],
                    }
                    session.run(
                        """
                        MATCH (m:Member {id: $memberId})
                        MERGE (pol:Policy {id: $id})
                        SET pol.type = $type, pol.startDate = $startDate,
                            pol.premiumMonthly = $premiumMonthly, pol.status = $status
                        MERGE (m)-[:HAS_POLICY]->(pol)
                        """,
                        policy,
                    )

                # 1-4 ordinary claims per member, against a random provider
                for _ in range(random.randint(1, 4)):
                    self._create_claim(member, random.choice(self.providers))
        print(f"Seeded {self.policy_counter} policies and {self.claim_counter} baseline claims")

    def _create_claim(self, member, provider):
        with self.driver.session() as session:
            self.claim_counter += 1
            filed = rand_date(date(2023, 1, 1), date(2024, 12, 1))
            claim = {
                "id": f"CLM-{self.claim_counter:05d}",
                "amount": round(random.uniform(85, 4200), 2),
                "dateOfService": filed,
                "dateFiled": filed,
                "status": random.choice(CLAIM_STATUSES),
                "diagnosisCode": random.choice(DIAGNOSIS_CODES),
                "memberId": member["id"],
                "providerId": provider["id"],
            }
            session.run(
                """
                MATCH (m:Member {id: $memberId})
                MATCH (p:Provider {id: $providerId})
                MERGE (c:Claim {id: $id})
                SET c.amount = $amount, c.dateOfService = $dateOfService,
                    c.dateFiled = $dateFiled, c.status = $status,
                    c.diagnosisCode = $diagnosisCode
                MERGE (m)-[:FILED]->(c)
                MERGE (c)-[:AGAINST]->(p)
                """,
                claim,
            )

    def create_identity_nodes(self):
        """Give every member their own address/bank account/phone (no sharing yet)."""
        with self.driver.session() as session:
            for i, member in enumerate(self.members, start=1):
                city, zip_code = CITIES[i % len(CITIES)]
                address = {
                    "line1": f"{100 + i} {random.choice(STREETS)}",
                    "city": city,
                    "zip": zip_code,
                    "memberId": member["id"],
                }
                bank = {"last4": gen_bank_last4(), "memberId": member["id"]}
                phone = {"number": gen_phone(), "memberId": member["id"]}

                session.run(
                    """
                    MATCH (m:Member {id: $memberId})
                    MERGE (a:Address {line1: $line1, city: $city, zip: $zip})
                    MERGE (m)-[:HAS_ADDRESS]->(a)
                    """,
                    address,
                )
                session.run(
                    """
                    MATCH (m:Member {id: $memberId})
                    MERGE (b:BankAccount {last4: $last4})
                    MERGE (m)-[:HAS_BANK_ACCOUNT]->(b)
                    """,
                    bank,
                )
                session.run(
                    """
                    MATCH (m:Member {id: $memberId})
                    MERGE (ph:Phone {number: $number})
                    MERGE (m)-[:HAS_PHONE]->(ph)
                    """,
                    phone,
                )
        print("Seeded per-member identity nodes (address / bank account / phone)")

    def create_fraud_rings(self):
        """
        Deliberately wire up a few groups of members to share ONE identity
        node and to all file claims against the SAME provider. This is what
        /api/fraud-rings and the "shared identity" 2-hop query are meant to
        surface -- without this step the detection queries have nothing to find.
        """
        rings = [
            {
                "kind": "address",
                "members": self.members[0:4],
                "provider": self.providers[0],
                "shared": {
                    "line1": "42 Meridian Ct, Unit 3",
                    "city": "Fairview",
                    "zip": "30144",
                },
            },
            {
                "kind": "bank_account",
                "members": self.members[8:12],
                "provider": self.providers[1],
                "shared": {"last4": "7788"},
            },
            {
                "kind": "phone",
                "members": self.members[16:19],
                "provider": self.providers[2],
                "shared": {"number": "555-010-2200"},
            },
            {
                "kind": "address",
                "members": self.members[24:29],
                "provider": self.providers[3],
                "shared": {
                    "line1": "9 Industrial Park Rd, Suite 12",
                    "city": "Clinton",
                    "zip": "52732",
                },
            },
        ]

        with self.driver.session() as session:
            for ring in rings:
                shared = ring["shared"]
                if ring["kind"] == "address":
                    session.run(
                        "MERGE (a:Address {line1: $line1, city: $city, zip: $zip})",
                        shared,
                    )
                    rel_query = """
                        MATCH (m:Member {id: $memberId})
                        MATCH (a:Address {line1: $line1, city: $city, zip: $zip})
                        MERGE (m)-[:HAS_ADDRESS]->(a)
                        """
                elif ring["kind"] == "bank_account":
                    session.run("MERGE (b:BankAccount {last4: $last4})", shared)
                    rel_query = """
                        MATCH (m:Member {id: $memberId})
                        MATCH (b:BankAccount {last4: $last4})
                        MERGE (m)-[:HAS_BANK_ACCOUNT]->(b)
                        """
                else:  # phone
                    session.run("MERGE (ph:Phone {number: $number})", shared)
                    rel_query = """
                        MATCH (m:Member {id: $memberId})
                        MATCH (ph:Phone {number: $number})
                        MERGE (m)-[:HAS_PHONE]->(ph)
                        """

                for member in ring["members"]:
                    params = dict(shared)
                    params["memberId"] = member["id"]
                    session.run(rel_query, params)
                    # every ring member also files a claim against the same provider
                    self._create_claim(member, ring["provider"])

        print(f"Seeded {len(rings)} deliberate fraud rings "
              f"({sum(len(r['members']) for r in rings)} member-claim pairs)")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reset", action="store_true",
                         help="Delete all nodes/relationships before seeding")
    parser.add_argument("--members", type=int, default=45)
    parser.add_argument("--providers", type=int, default=12)
    args = parser.parse_args()

    if not URI or not PASSWORD:
        print(
            "Missing COGNODB_URI / COGNODB_PASSWORD environment variables.\n"
            "Set them to the values from console.cognodb.com before running this script.",
            file=sys.stderr,
        )
        sys.exit(1)

    driver = GraphDatabase.driver(URI, auth=(USER, PASSWORD))
    try:
        driver.verify_connectivity()
    except Exception as exc:
        print(f"Could not connect to CognoDB at {URI}: {exc}", file=sys.stderr)
        sys.exit(1)

    seeder = Seeder(driver)
    try:
        if args.reset:
            print("Resetting graph...")
            seeder.reset()

        seeder.ensure_constraints()
        seeder.create_providers(n=args.providers)
        seeder.create_members(n=args.members)
        seeder.create_identity_nodes()
        seeder.create_policies_and_claims()
        seeder.create_fraud_rings()
        print("\nDone. Try: GET /api/fraud-rings?minRingSize=3 once the backend is running.")
    finally:
        driver.close()


if __name__ == "__main__":
    main()
