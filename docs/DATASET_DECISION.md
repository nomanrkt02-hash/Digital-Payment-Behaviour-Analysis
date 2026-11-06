# Dataset decision and audit status

## Current status — UCI subset present; scope limitations apply

The built-in `data/sample/demo_transactions.csv` and `data/live_demo/*` files are **synthetic**. They are retained for pipeline smoke testing and UI demonstration. Their model metrics must not be reported as real-world performance. The repository now also contains `data/real/UCI_Online_Retail_II_Project_Ready_INR.csv` and an archived evaluation report under `reports/real_uci/`. This is historical online retail data, not payment-system data; it has no payment-method field. Its report is separate from the active synthetic demo model. The application does not verify dataset provenance.

## Candidate A: Olist Brazilian E-Commerce Public Dataset

- Source: https://www.kaggle.com/olistbr/brazilian-ecommerce/
- Dataset card describes approximately 100,000 orders from 2016–2018 and includes order, customer, payment, product and review data.
- Licence shown on Kaggle: **CC BY-NC-SA 4.0**. Review the licence before redistribution or any commercial use.
- The customer join must use `customer_unique_id`, not `customer_id`; the latter is assigned per order.
- Known concern: public analyses report a low repeat-customer share (around 3%). This may make a 30-day repeat-purchase model weak, and the 30-day label rate must be measured from the actual files before accepting this dataset.
- Adapter: `scripts/prepare_olist.py`

### Audit it after downloading

1. Download the dataset ZIP from the official Kaggle source above.
2. Extract the CSV files into a local folder, for example `data/raw/olist/`.
3. Convert to the project's canonical schema:

   ```bash
   python -m scripts.prepare_olist data/raw/olist data/processed/olist_standard.csv
   ```

4. Run the audit:

   ```bash
   python -m scripts.audit_dataset data/processed/olist_standard.csv
   ```

5. Review repeat-customer share, history length, 30-day return-label feasibility, positive/negative label counts, cancelled orders, missing values and duplicates. Do not accept this candidate merely because it is real.

## Candidate B: UCI Online Retail II (alternative if repeat behaviour is too sparse)

- Source: https://archive.ics.uci.edu/dataset/502/online+retail+ii
- 1,067,371 transactions covering two years, with customer IDs, invoice IDs/dates, quantity, unit price and product descriptions.
- Licence shown by UCI: **CC BY 4.0**.
- It has richer repeat-transaction history, but **does not include a payment-method column**. That is a limitation for the project title and must be stated honestly if selected.
- Invoice numbers starting with `C` indicate cancellations. Quantity can be negative and must be audited/handled rather than treated as a positive order.
- Adapter (aggregates line items into invoice-level orders): `scripts/prepare_online_retail_ii.py`.

   ```bash
   python -m scripts.prepare_online_retail_ii path/to/online_retail_II.xlsx data/processed/online_retail_ii_standard.csv
   python -m scripts.audit_dataset data/processed/online_retail_ii_standard.csv
   ```

## Selection rule

Neither candidate is treated as final until its real files are downloaded and audited. The selected dataset must support a meaningful time-based 30-day target, enough repeat-customer examples, and an honest explanation of available payment fields. If neither candidate passes, select another source or revise the scope before claiming real-world model performance.
