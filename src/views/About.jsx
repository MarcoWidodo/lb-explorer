import { useData } from '../context/DataProvider'

export default function About() {
  const { manifest, countryName } = useData()
  const s = manifest.survey
  const totalN = manifest.waves.reduce((a, w) => a + w.n, 0)
  const fallbacks = Object.entries(manifest.countries).flatMap(([iso, c]) =>
    Object.entries(c.waves).filter(([, w]) => w.year_source !== 'data').map(([wv, w]) => ({ iso, wave: wv, year: w.year, source: w.year_source })))

  return (
    <div className="view-page dock-clearance">
      <div className="about">
        <h1>About the data</h1>
        <p className="view-subtitle">How every number on this site is produced, so that it can be checked and reproduced.</p>

        <section>
          <h2>What is here</h2>
          <p>
            {s.name}, {manifest.waves.length} waves ({manifest.waves[0].years} to {manifest.waves[manifest.waves.length - 1].years}),{' '}
            {Object.keys(manifest.countries).length} countries, {totalN.toLocaleString('en-US')} interviews.
            The Single-Wave, Map and Correlations views use every question in each wave's own file.
            The Time-Series view uses the {manifest.n_trends} questions that the project's harmonization crosswalk marks as comparable
            across waves, recoded onto one scale.
          </p>
          <table className="about-table">
            <thead><tr><th>Wave</th><th>Years</th><th className="num">Interviews</th><th>Countries</th></tr></thead>
            <tbody>
              {manifest.waves.map(w => (
                <tr key={w.id}><td>{w.label}</td><td>{w.years}</td><td className="num">{w.n.toLocaleString('en-US')}</td>
                  <td>{w.countries.map(countryName).join(', ')}</td></tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <h2>How the numbers are computed</h2>
          <dl className="about-defs">
            <dt>Weights</dt>
            <dd>Every percentage and mean uses the survey's within-country weight (W1–W2 <code>w_all</code>, W3 <code>allweight</code>, W4–W6 <code>w</code>). Weights average 1 in each country, so they correct the sample's composition inside a country and say nothing about the relative size of countries. Sample sizes (N) are unweighted counts.</dd>
            <dt>Denominator</dt>
            <dd><strong>Valid answers</strong> (the default) leaves out "don't know", "can't choose", "decline to answer" and "do not understand the question". <strong>All asked</strong> keeps them in the base, as the survey's own reports do. People who were not asked a question (skips, items not fielded in a country) are never counted.</dd>
            <dt>Means</dt>
            <dd>Means are shown only for ordered scales, yes/no items and numeric questions, and always with the meaning of the end points (for example "1 = Very good … 5 = Very bad"), because the original codes run in different directions in different questions and waves. Answers that are valid but not on the scale (such as "have not tried to use this service") count in percentages but not in means. Questions with unordered answers (party, religion, "which country…") are shown as distributions only.</dd>
            <dt>Uncertainty</dt>
            <dd>95% confidence intervals are ±1.96 standard errors, using the Kish effective sample size of the weights. The files carry no cluster or stratum information, so true intervals are somewhat wider. A difference of less than about 5 points between two single-country estimates should not be read as a change.</dd>
            <dt>Subgroups</dt>
            <dd>Gender, age and education come from the harmonized merge, so they are defined the same way in every wave: age groups under 30, 30–44, 45–59, 60+; education "primary or less" (harmonized codes 1–3), "secondary" (4–7) and "some university or more" (8–9). Urban/rural comes from each wave's sampling variable (<code>level3</code> in W1–W3, <code>level</code> in W4–W6, which code urban and rural in opposite directions). Groups with fewer than {manifest.min_cell_n} respondents are not shown.</dd>
            <dt>Regional averages</dt>
            <dd>The unweighted mean of the country estimates, so every country counts equally. A regional point is shown only for waves in which every member of the set was surveyed and asked the question; otherwise the line leaves that wave out rather than change its membership.</dd>
            <dt>Time axis</dt>
            <dd>Each country's point sits at its median interview year in that wave. Lines break where a country skipped a wave; nothing is interpolated.</dd>
            <dt>Correlations</dt>
            <dd><strong>Within a country:</strong> weighted Pearson correlation among respondents who answered both questions, with a two-sided t-test on the unweighted N. <strong>Across countries:</strong> the Pearson correlation of the weighted country means, one point per country.</dd>
          </dl>
        </section>

        <section>
          <h2>Harmonization</h2>
          <p>
            The time series come from <code>HarmonizedMerge_v1.sav</code>, which applies the machine-readable "Recode Rules" sheet of{' '}
            <code>ABS_Variable_Harmonization_Crosswalk.xlsx</code> (audited September 2026) to the six wave files. The question details panel in the
            Time-Series view lists the source question and recode rule for every wave, and the crosswalk's notes on comparability.
          </p>
        </section>

        {fallbacks.length > 0 && (
          <section>
            <h2>Fieldwork years not recorded in the data</h2>
            <ul className="about-list">
              {fallbacks.map(f => <li key={`${f.iso}${f.wave}`}>{countryName(f.iso)}, Wave {f.wave}: {f.year}. {f.source}</li>)}
            </ul>
          </section>
        )}

        <section>
          <h2>Changes from the March 2026 version</h2>
          <ul className="about-list">
            <li>Wave 6 (2021–23, 11 countries) added.</li>
            <li>Time series rebuilt from the audited crosswalk. About 60 recode directions were corrected, including the Wave 1–2 economic evaluations, which the earlier site showed upside down.</li>
            <li>Means are no longer computed for unordered questions or identifiers, and end-point labels now accompany every mean.</li>
            <li>Country codes, interview dates, regions and other non-substantive variables are no longer offered for correlation.</li>
            <li>Percentages and counts now come from the same respondents, and Cambodia no longer appears in Wave 5, where it was not surveyed.</li>
            <li>New: denominator choice, subgroup breakdowns, regional averages on a real year axis, confidence intervals, and print-ready greyscale exports with tidy CSVs.</li>
            <li>Pages now load only the data they show (typically a few kilobytes per question) instead of up to 34 MB per wave.</li>
          </ul>
        </section>

        <section>
          <h2>Source and citation</h2>
          <p>{s.citation} {s.attribution}</p>
          <p className="about-small">Site data built {manifest.built} from:</p>
          <table className="about-table about-small">
            <tbody>{manifest.sources.map(f => <tr key={f.file}><td><code>{f.file}</code></td><td><code>{f.md5}</code></td></tr>)}</tbody>
          </table>
          <p className="about-small">Questions or errors: <a href={`mailto:${s.contact}`}>{s.contact}</a>.</p>
        </section>
      </div>
    </div>
  )
}
