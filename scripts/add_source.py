#!/usr/bin/env python3
"""Add a statistic to the site from an Our World in Data grapher.

Usage:
    python3 scripts/add_source.py <grapher-slug>

The identifier can be the grapher slug (e.g. "maternal-mortality") or the
full page URL (e.g. "https://ourworldindata.org/grapher/maternal-mortality").

The script downloads the data and metadata, keeps the "World" series and
writes:
    api/data/<slug>/data.csv    (columns: year,value)
    api/data/<slug>/meta.json

Standard library only, no dependencies.
"""

import csv
import io
import json
import os
import re
import sys
import urllib.request

BASE_URL = "https://ourworldindata.org/grapher/{slug}"
USER_AGENT = "better-back-then-contributor/1.0"


def die(message):
    print(f"Error: {message}")
    sys.exit(1)


def extract_slug(user_input):
    user_input = user_input.strip().strip("/")
    match = re.search(r"ourworldindata\.org/grapher/([^/?#]+)", user_input)
    return match.group(1) if match else user_input


def fetch(url):
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.read().decode("utf-8")
    except urllib.error.HTTPError as error:
        if error.code == 404:
            die(f"not found on Our World in Data (404): {url}")
        die(f"download failed ({error.code}): {url}")
    except urllib.error.URLError as error:
        die(f"network unreachable: {error.reason}")


def ask(question, default=None):
    suffix = f" [{default}] " if default is not None else " "
    answer = input(question + suffix).strip()
    return answer if answer else default


def ask_yes_no(question):
    while True:
        answer = input(question + " (y/n): ").strip().lower()
        if answer in ("y", "yes"):
            return True
        if answer in ("n", "no"):
            return False
        print("Please answer with y or n.")


def clean_markdown_links(text):
    # "[maternal conditions](#dod:...)" -> "maternal conditions"
    return re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", text).strip()


def lookup_series_metadata(columns, series_name):
    """Find the metadata block for a series.

    Metadata keys often differ from the CSV header (e.g. the CSV says
    "Share of the population with access to electricity" while the metadata
    key is "Access to electricity (% of population)"). Annotations columns
    (keys ending in "-annotations") are ignored.
    """
    def real_columns():
        return {key: block for key, block in columns.items() if not key.endswith("-annotations")}

    candidates = real_columns()
    if series_name in candidates:
        return candidates[series_name]
    for key, block in candidates.items():
        if key.strip().lower() == series_name.strip().lower():
            return block
    if len(candidates) == 1:
        return next(iter(candidates.values()))
    return {}


def non_empty(question):
    while True:
        answer = ask(question).strip()
        if answer:
            return answer
        print("This field is required.")


def main():
    user_input = sys.argv[1] if len(sys.argv) > 1 else ask("OWID grapher slug or URL:")
    if not user_input:
        die("no identifier provided.")

    slug = extract_slug(user_input)
    out_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "api", "data", slug)

    if os.path.isdir(out_dir):
        if not ask_yes_no(f"The folder api/data/{slug} already exists, replace it?"):
            die("aborted.")

    # --- Metadata ----------------------------------------------------------
    print(f"Downloading metadata for '{slug}'...")
    metadata = json.loads(fetch(BASE_URL.format(slug=slug) + ".metadata.json"))
    chart = metadata.get("chart", {})
    columns = metadata.get("columns", {})

    title = chart.get("title")
    if not title:
        die("the grapher has no title.")

    subtitle = chart.get("subtitle") or ""
    print(f"\nTitle: {title}")
    print(f"URL: {BASE_URL.format(slug=slug)}")
    if subtitle:
        print(f"Subtitle: {subtitle}")

    # --- Data --------------------------------------------------------------
    print("Downloading data...")
    rows = list(csv.reader(io.StringIO(fetch(BASE_URL.format(slug=slug) + ".csv"))))
    header = rows[0]
    col_entity = header.index("Entity")
    col_year = header.index("Year")
    value_columns = [i for i, name in enumerate(header) if i not in (col_entity, col_year) and name != "Code"]

    data_rows = [row for row in rows[1:] if row[col_entity] == "World" and row[col_year].lstrip("-").isdigit()]
    if not data_rows:
        entities = sorted({row[col_entity] for row in rows[1:]})[:10]
        die("no 'World' rows in the data. "
            f"Available entities (sample): {', '.join(entities)}...")

    # Charts with several series (high/low estimates, annotations...) require
    # the user to pick which one to keep.
    if len(value_columns) > 1:
        print("\nThis grapher contains several series:")
        for i, col in enumerate(value_columns):
            print(f"  {i + 1}. {header[col]}")
        choice = ask("Which series should be kept?", "1")
        try:
            selected = value_columns[int(choice) - 1]
        except (ValueError, IndexError):
            die("invalid series choice.")
    else:
        selected = value_columns[0]

    points = {}
    for row in data_rows:
        try:
            value = float(row[selected])
        except ValueError:
            continue
        if value != value:  # NaN
            continue
        points[int(row[col_year])] = value
    years = sorted(points)

    print(f"\n{len(years)} data points: {years[0]} -> {years[-1]}")
    preview = ", ".join(f"{year}:{points[year]:g}" for year in years[:3])
    print(f"Preview: {preview}...")
    series_meta = lookup_series_metadata(columns, header[selected])
    timespan = series_meta.get("timespan")
    if timespan:
        try:
            metadata_start = int(str(timespan).split("-")[0])
            if years[0] > metadata_start:
                print(f"Warning: the 'World' series only starts in {years[0]}, "
                      f"while country-level data go back to {metadata_start}. "
                      "Cards for earlier reference years will not include this statistic.")
        except ValueError:
            pass

    # --- Fill in what the grapher does not provide -------------------------
    description = clean_markdown_links(subtitle) if subtitle else series_meta.get("descriptionShort")
    if not description:
        description = non_empty("No description found in the grapher, please enter one:")

    unit = series_meta.get("unit") or series_meta.get("shortUnit") or header[selected]
    print(f"\nDetected unit: {unit}")
    positive_upward_trend = ask_yes_no("Is it good news when the value goes up?")

    # --- Write -------------------------------------------------------------
    os.makedirs(out_dir, exist_ok=True)

    csv_path = os.path.join(out_dir, "data.csv")
    with open(csv_path, "w", newline="\n") as file:
        file.write("year,value\n")
        for year in years:
            file.write(f"{year},{points[year]!r}\n")

    meta = {
        "title": title,
        "description": description,
        "source": BASE_URL.format(slug=slug),
        "unit": unit,
        "positive_upward_trend": positive_upward_trend,
    }
    meta_path = os.path.join(out_dir, "meta.json")
    with open(meta_path, "w", newline="\n") as file:
        json.dump(meta, file, indent=2, ensure_ascii=False)
        file.write("\n")

    print(f"\nWritten: data.csv ({len(years)} points) and meta.json in api/data/{slug}/")


if __name__ == "__main__":
    main()
