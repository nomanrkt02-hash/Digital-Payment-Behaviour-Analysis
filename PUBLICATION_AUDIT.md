# Final publication-readiness audit

Review date: 2026-11-06
Reviewed folder: `C:\Users\dell\Desktop\CEP Project\Digital-Payment-Behaviour-Analysis-GitHub`

## Scope and method

A second-stage read-only review inventoried all **168 files** (20,609,565 bytes total). Text files and filenames were searched locally for likely credential patterns; CSV/XLSX structure and headers were checked without printing row values; the six PNG screenshots were visually inspected. The default model was inspected as a pickle/joblib byte stream using Python's static `pickletools` parser. It was **not** loaded, unpickled, trained, or modified. No packages were installed, tests were run, Git commit created, or upload performed. The only permitted change in this stage is this audit report.

The root project source was not modified.

## Findings

### Privacy and secrets

- The filename scan found no `.env`, credential/secret-named file, log, database, PEM, or key file.
- The local text scan found no likely API-key, bearer-token, AWS-key, password assignment, or private-key marker in included text, source, documentation, package/configuration files, or notebooks. There are **no notebooks** in this copy. The scan is heuristic and cannot guarantee that no secret exists.
- `api.py` uses local development origins by default. `DPBA_ALLOWED_ORIGINS` and frontend `VITE_API_BASE_URL` are optional overrides, not populated secrets. No private URL or local machine path was found in the app configuration.
- No personal name, email, postal address, or phone field is present in the demo dataset headers. Email-pattern scanning found no matches. Numeric-looking patterns are expected in generated IDs, timestamps, and amounts; a broad phone-number heuristic falsely matches those values and is not evidence of real phone records.
- `src/demo_data.py` explicitly generates demo transactions with seeded synthetic customer/order IDs, randomized behavior, categories, payment methods, values, and statuses. `scripts/make_live_demo_files.py` creates the upload examples from that generator and adds hand-authored fictional story IDs C001–C008. The included dataset rows are generated examples, not observed customer records. This review found no indication of real personal/customer data in them.
- The six screenshots show the synthetic-demo label and fictional IDs/figures. I saw no usernames, local paths, email addresses, real customer details, or workstation information. They do show product screens, mock customer behavior, status counts, and rule-based action examples; treat those as intentionally public product details and confirm that is acceptable.

### Screenshots and image assets

`documentation/screenshots/Customer.png`, `Data.png`, `Insights.png`, `Outreach.png`, `Overview.png`, and `Welcome.png` were inspected visually. They depict the local app with synthetic data. No privacy issue was visible. The custom favicon is a small inline SVG icon and contains no embedded metadata or identifying content; its authorship/provenance is not marked in the file.

### Saved model

Only `models/return_model.joblib` is included (13,560,408 bytes). Static parsing exposed references to the project's `src.model_utils.ReturnModel`, a scikit-learn `Pipeline`, `SimpleImputer`, joblib's NumPy array wrapper, and the behavioral feature names. The inspected string data contained no email, phone, username, or local-path values. The serialized NumPy/model state is opaque to this non-executing inspection, so I cannot certify all model metadata or prove that no information is encoded in its arrays. Project source and generator comments identify the default artifact as trained on the synthetic demo data. It is the path required by the default pipeline. I did not execute or deserialize it; consumers should only load trusted joblib/pickle artifacts.

The excluded UCI model is absent and is not required for the documented synthetic demo.

### Synthetic data files

All six CSV/XLSX files under `data/` are present. Their schema contains transaction/customer IDs, dates, payment values, categories, payment types, and order statuses; no direct contact/identity fields were found. The XLSX was inspected through its ZIP/XML parts without invoking workbook code: it has 9,055 rows including the header and uses the same synthetic upload schema as its CSV counterpart. The sample file has 30,440 rows; live examples range from 200 to 9,094 rows and are generator-based validation cases. `live_demo_messy_synthetic.csv` intentionally contains malformed/test rows such as blanks and invalid dates; that is test input, not evidence of private records.

### README and included documentation

The new `README.md` correctly describes the 30-day repeat-purchase objective, synthetic demo/model, rule-based recommendations, local API/frontend setup, optional environment overrides, and omitted UCI-derived records. No invented performance metrics were found.

Two included documents conflict with the packaged copy or current implementation and should be corrected before presenting the documentation as authoritative:

1. `docs/DATASET_DECISION.md` says the UCI-derived CSV and archived report are present, but both are excluded from this folder. Its dataset-candidate source/license statements are contextual notes, not approval to redistribute those datasets.
2. `docs/LIVE_DEMO_GUIDE.md` tells the presenter that a Settings control fits the model to uploaded data. The inspected API's `/api/settings` endpoint only recalculates business-rule recommendations; uploaded-data training occurs in `/api/analyze`. The guide's example counts and customer-specific outcomes are also environment/model dependent and should not be presented as guaranteed results.

The README points readers to these documents, so the inconsistencies are visible to users. This audit-only stage did not edit them.

## Licensing and attribution

- There is no project `LICENSE` file. Publishing publicly without one does **not** grant general permission to copy, modify, redistribute, or make derivative works from the owner's code; GitHub users can view and fork under GitHub's platform terms, but that is not an open-source reuse license. The owner should decide whether the goal is “view/fork only” or reuse, and then choose an appropriate license after confirming ownership and contributor rights. See [GitHub's licensing guidance](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository).
- `frontend/src/components/ui/` contains source patterns strongly resembling shadcn/ui distributed component code. The upstream project states MIT licensing, and its MIT text requires retaining the copyright and permission notice with copies or substantial portions. No upstream notice is present in this copy. Confirm component provenance and, if these components derive from shadcn/ui, add its required notice before publication. See the [upstream license](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md).
- Frontend code imports `lucide-react`; the upstream Lucide project identifies ISC licensing. The package is not vendored here, but icon artwork appears in the source-rendered screenshots. Review its notice requirements and the lockfile's other third-party package licenses when distributing built artifacts. See the [Lucide license information](https://github.com/lucide-icons/lucide).
- The bundled transaction examples are generated by the included project scripts; no separate dataset license is identified. Confirm the project owner has rights to publish the generator and its generated examples.
- Screenshots appear to be captures of this app, but authorship and permissions for any underlying UI components/icons should be covered by the preceding attribution review.
- The UCI-derived dataset/model, UCI evaluation reports, and Olist transaction data are not included. The included dataset-decision note mentions UCI CC BY 4.0 and Olist CC BY-NC-SA 4.0; those notes do not substitute for checking exact source files, transformation rights, attribution, and applicable terms if those datasets are ever added.

Do not add a project license until the owner makes that decision. If the owner does not want to grant reuse rights, state that clearly in the README; a public repository remains viewable/forkable under GitHub's platform terms.

## GitHub size assessment

- Folder total: **20,609,565 bytes** (about 19.65 MiB).
- Largest file: `models/return_model.joblib`, **13,560,408 bytes** (about 12.93 MiB).
- Largest dataset: `data/sample/demo_transactions.csv`, **1,979,491 bytes** (about 1.89 MiB).
- Every included file is below 25 MiB, so none exceeds GitHub's browser single-file upload cap; there are 168 files, so a browser upload would need multiple batches because GitHub allows at most 100 files per upload. The model is also below GitHub's 50 MiB warning threshold and 100 MiB hard file limit. The command-line workflow can add files larger than the browser cap up to GitHub's 100 MiB limit. See [GitHub's file-size guidance](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github) and [file upload limits](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository).
- No Git LFS is needed for the current included files based on size alone.

## Excluded-file dependency check

The default demo uses `data/sample/demo_transactions.csv` (or generates it using `src/demo_data.py`) and `models/return_model.joblib`; both are included. The documented live CSV/XLSX upload examples are included under `data/live_demo/`. The excluded UCI dataset/model and reports, notebook, duplicate `payment-patterns-main/`, academic files, and generated build/dependency folders are not required for the README's default synthetic demo workflow.

Documentation remains inconsistent as described above: `docs/DATASET_DECISION.md` references omitted UCI files, and `docs/LIVE_DEMO_GUIDE.md` has the stale Settings/retraining step. The source code itself was not changed.

## Inventory correction

All 168 files are present; no Git metadata, `.env`, notebook, installed dependency tree, Python cache, generated build directory, UCI data, or UCI model is present. The npm lockfile **and** the alternative `frontend/bun.lock`/`frontend/bunfig.toml` are included; npm is the documented installation path. Earlier audit wording that said Bun files were excluded was inaccurate. The earlier audit also left screenshot review pending; all six screenshots have now been visually reviewed as described above.

## Final assessment

**NOT READY — REVIEW REQUIRED.** Resolve the third-party source/notice question, decide the owner's license and contributor rights, and correct or remove the two stale included documentation claims before treating this copy as publication-ready. The data/model sizing and privacy review found no blocker for the synthetic demo files; model-array internals remain opaque to safe static inspection.

