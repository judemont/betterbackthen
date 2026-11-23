# Better Back Then?

A small web app that challenges the claim that "things were better back then". Enter a year, and it shows a selection of global statistics (life expectancy, child mortality, poverty, CO₂ emissions...) charted from that reference year to today.

Most of the data comes from [Our World in Data](https://ourworldindata.org).

## Contributing a data source

Statistics are stored as plain files and loaded automatically. No registration step, no code changes needed.

A helper script does most of the work for *Our World in Data* sources:

```sh
python3 scripts/add_source.py <grapher-slug>
```

It downloads the data and metadata for that grapher, keeps the `World` series, and writes the folder for you. It only asks which series to keep (when the chart has several) and whether an upward trend is good news.

Manual steps:

1. Create a new folder under `api/data/`, named after your statistic (e.g. `api/data/teen-birth-rates/`).
2. Add a `data.csv` file with two columns, `year` and `value`, one point per line:

   ```csv
   year,value
   1990,42.8
   1991,41.2
   ```

3. Add a `meta.json` file describing the statistic:

   ```json
   {
     "title": "Teen birth rate",
     "description": "Births per 1,000 women aged 15-19.",
     "source": "https://ourworldindata.org/grapher/...",
     "unit": "births per 1,000",
     "positive_upward_trend": false
   }
   ```

Notes:

- The first two columns of the CSV are used; extra columns are ignored.
- Set `positive_upward_trend` to `true` if it is good news when the value goes up (e.g. life expectancy), `false` otherwise. Only statistics that improved since the selected year are displayed.
- The `source` link is shown on the statistic's card. Please credit the original data provider.
