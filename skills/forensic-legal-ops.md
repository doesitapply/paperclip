---
name: Forensic Legal-Ops
description: >
  High-velocity legal extraction and verification for case CR23-0657. 
  Provides protocols for OneDrive evidence mapping and structural-error detection.
---

# Forensic Legal-Ops Skill

This skill empowers you to execute autonomous legal operations for case **CR23-0657** by leveraging the **Primary Evidence Repository**.

## Primary Evidence Repository
- **Root Path**: `/Users/cameronchurch/Library/CloudStorage/OneDrive-Personal/A Motions`
- **Objective**: All exhibits and filings MUST be verified against this directory.

## Case Context: Structural Errors
Focus on these three core categories of structural defect identified in CHU-5:

1.  **Faretta Suppression**: The court suppressed the motion to proceed pro se.
2.  **Competency Irregularities**: The competency trigger lacked a sufficient factual basis.
3.  **Retaliation Patterns**: Identifying the timing of warrants (e.g., 2024-12-19) relative to pro se filings.

## Extraction Protocols
When parsing documents in the OneDrive repository, follow these naming conventions:
- **"clerk-stamped"**: Indicates a filed and accepted document. These are "Ground Truth".
- **"proposed"**: Indicates a draft not yet filed.
- **"objection"**: Critical for identifying non-acquiescence.

## Verification Workflow
1.  **Locate**: Find the file in the OneDrive root or subdirectories.
2.  **Verify**: Confirm the "Clerk Stamped" marking in the file metadata or visual content if possible.
3.  **Link**: When producing an exhibit appendix (CHU-6), use the absolute path to the OneDrive file as the source.

## Motion Drafting Patterns
- Always demand **Written Findings** for any contested procedural ruling.
- Citation format: Refer to OneDrive files by their full basename for clarity.
