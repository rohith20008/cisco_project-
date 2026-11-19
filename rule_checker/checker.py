"""
NetSage AI - Deterministic Network Rule Checker

Usage:
    python checker.py
    python checker.py netsage_cases.csv

Input:
    cases.csv with columns:
    case_code, symptom, topology_note, show_outputs,
    expected_fault, osi_layer, concept, severity

Output:
    rule_results.csv
"""

import csv
import ipaddress
import re
import sys
from pathlib import Path


def result(case_code, rule_type, status, message, evidence=""):
    return {
        "case_code": case_code,
        "rule_type": rule_type,
        "status": status,
        "message": message,
        "evidence": evidence,
    }


def extract_ips(text):
    return re.findall(r"\b(?:\d{1,3}\.){3}\d{1,3}\b", text)


def valid_ip(value):
    try:
        ipaddress.ip_address(value)
        return True
    except ValueError:
        return False


def check_duplicate_ips(text, case_code):
    # Deterministic duplicate-IP check:
    # only flag when the evidence explicitly indicates duplication.
    explicit = re.search(
        r"(?:duplicate\s+ip|ip\s+address(?:es)?\s+duplicated|"
        r"same\s+ip\s+address|ip\s+appears\s+on\s+(?:multiple|two|both))",
        text,
        re.I,
    )

    if explicit:
        ips = [ip for ip in extract_ips(text) if valid_ip(ip)]
        return result(
            case_code,
            "duplicate_ip",
            "FAIL",
            "Evidence explicitly indicates a possible duplicate IP address.",
            ", ".join(sorted(set(ips))) if ips else explicit.group(0),
        )

    return result(
        case_code,
        "duplicate_ip",
        "PASS",
        "No explicit duplicate IP condition detected.",
    )


def check_gateway_mismatch(text, case_code):
    # Detects common forms such as:
    # IP 192.168.1.25 mask 255.255.255.0 gateway 192.168.2.1
    pattern = re.compile(
        r"IP\s+((?:\d{1,3}\.){3}\d{1,3})"
        r".*?mask\s+((?:\d{1,3}\.){3}\d{1,3})"
        r".*?gateway\s+((?:\d{1,3}\.){3}\d{1,3})",
        re.IGNORECASE,
    )

    for ip, mask, gateway in pattern.findall(text):
        try:
            network = ipaddress.ip_network(f"{ip}/{mask}", strict=False)
            if ipaddress.ip_address(gateway) not in network:
                return result(
                    case_code,
                    "gateway_mismatch",
                    "FAIL",
                    f"Gateway {gateway} is outside host subnet {network}.",
                    f"IP={ip}, mask={mask}, gateway={gateway}",
                )
        except ValueError:
            continue

    if re.search(r"wrong default gateway|gateway mismatch|different subnet", text, re.I):
        return result(
            case_code,
            "gateway_mismatch",
            "FAIL",
            "Evidence indicates the configured gateway does not match the host subnet.",
            text,
        )

    return result(
        case_code,
        "gateway_mismatch",
        "PASS",
        "No gateway mismatch detected.",
    )


def check_wrong_mask(text, case_code):
    # Detect obvious mask/network inconsistencies in textual evidence.
    if re.search(
        r"wrong (?:subnet )?mask|incorrect mask|invalid mask|mask mismatch",
        text,
        re.I,
    ):
        return result(
            case_code,
            "wrong_mask",
            "FAIL",
            "Evidence indicates an incorrect subnet mask.",
            text,
        )

    # Basic validation of dotted-decimal masks if present.
    masks = re.findall(
        r"(?:mask|subnet mask)\s+((?:\d{1,3}\.){3}\d{1,3})",
        text,
        re.I,
    )

    for mask in masks:
        try:
            ipaddress.ip_network(f"0.0.0.0/{mask}")
        except ValueError:
            return result(
                case_code,
                "wrong_mask",
                "FAIL",
                f"Invalid subnet mask detected: {mask}",
                f"Mask={mask}",
            )

    return result(
        case_code,
        "wrong_mask",
        "PASS",
        "No incorrect subnet mask detected.",
    )


def check_interface_down(text, case_code):
    if re.search(
        r"(?:administratively down|interface .*?\bdown\b|link is down|interface is down)",
        text,
        re.I,
    ):
        return result(
            case_code,
            "interface_down",
            "FAIL",
            "An interface/link-down condition is present.",
            text,
        )

    return result(
        case_code,
        "interface_down",
        "PASS",
        "No interface-down condition detected.",
    )


def check_missing_vlan(text, case_code):
    if re.search(
        r"(?:VLAN\s+\d+.*(?:not present|missing|absent)|"
        r"missing VLAN|VLAN .* not (?:allowed|assigned|carried))",
        text,
        re.I,
    ):
        return result(
            case_code,
            "missing_vlan",
            "FAIL",
            "Evidence indicates a missing, unassigned, or disallowed VLAN.",
            text,
        )

    return result(
        case_code,
        "missing_vlan",
        "PASS",
        "No missing/disallowed VLAN condition detected.",
    )


def check_missing_route(text, case_code):
    if re.search(
        r"(?:no\s+route\s+to|missing\s+route|"
        r"route\s+(?:is\s+)?(?:absent|missing)|"
        r"no\s+(?:matching\s+)?route)",
        text,
        re.I,
    ):
        return result(
            case_code,
            "missing_route",
            "FAIL",
            "Evidence indicates a missing or unavailable route.",
            text,
        )

    return result(
        case_code,
        "missing_route",
        "PASS",
        "No explicit missing-route condition detected.",
    )



def run_case(row):
    case_code = row["case_code"]
    evidence = " ".join(
        [
            row.get("symptom", ""),
            row.get("topology_note", ""),
            row.get("show_outputs", ""),
        ]
    )

    checks = [
        check_duplicate_ips(evidence, case_code),
        check_wrong_mask(evidence, case_code),
        check_gateway_mismatch(evidence, case_code),
        check_interface_down(evidence, case_code),
        check_missing_vlan(evidence, case_code),
        check_missing_route(evidence, case_code),
    ]

    return checks


def main():
    csv_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("netsage_cases.csv")

    if not csv_path.exists():
        print(f"ERROR: Could not find {csv_path}")
        print("Place checker.py in the same folder as netsage_cases.csv")
        print("or run: python checker.py path/to/netsage_cases.csv")
        sys.exit(1)

    with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    required = {
        "case_code",
        "symptom",
        "topology_note",
        "show_outputs",
        "expected_fault",
        "osi_layer",
        "concept",
        "severity",
    }

    missing = required - set(reader.fieldnames or [])
    if missing:
        print("ERROR: Missing CSV columns:", ", ".join(sorted(missing)))
        sys.exit(1)

    all_results = []

    for row in rows:
        all_results.extend(run_case(row))

    output_path = csv_path.parent / "rule_results.csv"

    fieldnames = [
        "case_code",
        "rule_type",
        "status",
        "message",
        "evidence",
    ]

    with output_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(all_results)

    failures = [r for r in all_results if r["status"] == "FAIL"]

    print("\n" + "=" * 65)
    print("NETSAGE AI - RULE CHECKER")
    print("=" * 65)
    print(f"Cases checked : {len(rows)}")
    print(f"Rules/case    : 6")
    print(f"Total checks  : {len(all_results)}")
    print(f"Failures      : {len(failures)}")
    print(f"Output        : {output_path}")
    print("=" * 65)

    print("\nFAILURES / WARNINGS")
    print("-" * 65)

    if not failures:
        print("No deterministic rule failures detected.")
    else:
        for item in failures:
            print(
                f"[{item['case_code']}] "
                f"{item['rule_type']} -> {item['message']}"
            )

    print("\nSample output")
    print("-" * 65)

    for item in all_results[:12]:
        print(
            f"{item['case_code']:5} | "
            f"{item['rule_type']:18} | "
            f"{item['status']:4} | "
            f"{item['message']}"
        )


if __name__ == "__main__":
    main()
