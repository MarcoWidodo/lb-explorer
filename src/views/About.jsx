import { useData, useResource, api } from '../context/DataProvider'

export default function About() {
  const { manifest, countryName } = useData()
  const { data: index } = useResource(() => api.index(), [])
  const s = manifest.survey
  const totalN = manifest.waves.reduce((a, w) => a + w.n, 0)
  const notes = (index?.vars || []).filter(v => v.note || v.tb)

  return (
    <div className="view-page dock-clearance">
      <div className="about">
        <h1>About the data</h1>
        <p className="view-subtitle">How every number on this site is produced, so that it can be checked and reproduced.</p>

        <section>
          <h2>What is here</h2>
          <p>
            {s.name}, {manifest.waves.length} survey years from {manifest.waves[0].label} to {manifest.waves[manifest.waves.length - 1].label},{' '}
            {Object.keys(manifest.countries).length} Latin American countries, {totalN.toLocaleString('en-US')} interviews, and{' '}
            {manifest.n_questions} questions: every question asked in three or more survey years (birthdate, a date rather than a question, is left out; age is shown instead). {manifest.gaps_note}
          </p>
          <p>
            The numbers come from <code>LB_TimeSeries_Clean_v1.sav</code>, a cleaned version of Latinobarómetro's own 1995–2024 time-series
            merge, checked respondent by respondent against the 24 yearly files (September 2026). The cleaning removes Spain (in the merge for
            1996–2017), applies one rule to missing-value codes, and corrects five errors in the merge: crime victimisation (where "no" had been
            stored as "a relative", so the victim rate read 98% in some years), the 2015 economic evaluations, Chile's 2017 life satisfaction, and
            the labels and 1995 values of the opinion-of-Europe item. Nothing else is changed.
          </p>
          <div className="corr-table-scroll">
            <table className="about-table">
              <thead><tr><th>Year</th><th className="num">Interviews</th><th className="num">Countries</th><th>Not surveyed</th></tr></thead>
              <tbody>
                {manifest.waves.map(w => (
                  <tr key={w.id}><td>{w.label}</td><td className="num">{w.n.toLocaleString('en-US')}</td><td className="num">{w.countries.length}</td>
                    <td>{Object.keys(manifest.countries).filter(c => !w.countries.includes(c)).map(countryName).join(', ') || '—'}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2>How the numbers are computed</h2>
          <dl className="about-defs">
            <dt>Weights</dt>
            <dd>Every percentage and mean uses Latinobarómetro's weight (<code>weight</code>, the merge's <code>X_020</code>), which averages 1 within each country-year. It corrects the sample's composition inside a country and says nothing about the relative size of countries. Sample sizes (N) are unweighted counts.</dd>
            <dt>Denominator</dt>
            <dd><strong>Valid answers</strong> (the default) leaves out "don't know" and "no answer". <strong>All asked</strong> keeps them in the base, as Latinobarómetro's published figures do; for example, 47.8%, 48.0% and 51.6% of all Latin Americans asked in 2018, 2023 and 2024 said democracy is preferable (published: 48, 48 and 52). Respondents who were not asked a question, for whom it did not apply, or who answered "none" where that is coded as missing, are never counted. In the data, codes −1, −2 and −5 are "don't know / no answer" (the merge is not consistent about −1 versus −2, so they are shown as one category); all other negative codes mean "not asked". A few positive codes are also non-answers and are treated as such: "No responde" in the most-important-problem question, "Voto secreto" in vote intention, "I don't remember what I did" in turnout, and "Unknown" in one leader rating.</dd>
            <dd>When every respondent in a country-year is coded "don't know / no answer", the question was in effect not asked there (for example, confidence in the armed forces in Costa Rica and Panama, which have none), and that country-year is left out rather than shown as 0%.</dd>
            <dt>Means</dt>
            <dd>Means are offered only for interval-like scales (0–10 and 1–10 scales) and numeric questions such as age, always with the meaning of the end points. For shorter scales the site shows the share in the top categories instead (for example "a lot of + some confidence"). Valid answers that are not on the scale (such as "doesn't have a job" in a job-security question) count in percentages but not in means. Questions with unordered answers (vote intention, most important problem, religion) are shown as distributions only.</dd>
            <dt>Uncertainty</dt>
            <dd>95% confidence intervals are ±1.96 standard errors, using the Kish effective sample size of the weights. The merge carries no cluster or stratum information, so true intervals are somewhat wider. Each country-year has about 1,000–1,200 respondents (Paraguay about 600 before 2005), so a single-country change of less than about 5 points between two years should not be read as a change without a proper test. The regional averages are much more precise.</dd>
            <dt>Subgroups</dt>
            <dd>Gender (<code>S_001</code>); age (<code>S_002</code>) under 30, 30–44, 45–59, 60+; education (<code>S_101</code>) primary or less (codes 1–3), secondary or technical (4–5), higher (6–7); and town size (<code>X_008</code>) capital city, other city of 100,000+, and towns under 100,000. Latinobarómetro does not record urban/rural; town size was asked from 2001 only. In 2016 the merge's education recode differs from the yearly file for about 4% of respondents. Groups with fewer than {manifest.min_cell_n} respondents are not shown.</dd>
            <dt>Regional averages</dt>
            <dd>The unweighted mean of the country estimates, so every country counts equally, over a fixed set of countries; a year is shown only when every member was surveyed and asked, as in <code>lb_region()</code>. A pooled "Latin America" figure (all respondents in one pot) would let changes in which countries were surveyed move the line, so it is not used for trends. The sets:
              <ul className="about-list">
                {manifest.country_sets.map(cs => <li key={cs.id}><strong>{cs.label}</strong>{cs.span ? ` (${cs.span})` : ''}: {cs.countries.map(countryName).join(', ')}.{cs.note ? ` ${cs.note}` : ''}</li>)}
              </ul>
            </dd>
            <dt>Time axis</dt>
            <dd>Points sit on calendar years with a marker at each survey year. {manifest.gaps_note} Lines break where a country was not surveyed or not asked in a year the question was asked elsewhere; nothing is interpolated. Comparability breaks listed below are never bridged.</dd>
            <dt>Correlations</dt>
            <dd><strong>Within a country:</strong> weighted Pearson correlation among respondents who answered both questions in that country-year, on the original answer codes, with a two-sided t-test on the unweighted N. <strong>Across countries:</strong> the Pearson correlation of the countries' values (the default summary of each question), one point per country.</dd>
            <dt>Exports</dt>
            <dd>Every chart exports as SVG, a 300-dpi PNG (9 × 5.5 in) and a tidy CSV of exactly the plotted values, with the columns <code>indicator, variable, success_codes, base, country_set, year, iso3, country, group, value, se, n, n_countries</code>. The greyscale print style tells series apart by line type and marker shape, as in the project's slides.</dd>
          </dl>
        </section>

        {notes.length > 0 && (
          <section>
            <h2>Comparability notes</h2>
            <p>From the audit of Latinobarómetro's merge. Each note also appears with its question.</p>
            <table className="about-table about-small">
              <tbody>{notes.map(v => <tr key={v.id}><td><code>{v.id}</code></td><td>{v.q}</td><td>{[v.tb?.note, v.note].filter(Boolean).join(' ')}</td></tr>)}</tbody>
            </table>
          </section>
        )}

        <section>
          <h2>Terms of use</h2>
          <p>Latinobarómetro's website sets these conditions for its data (quoted from latinobarometro.org, September 2026):</p>
          <blockquote className="about-quote">
            "Los conjuntos (SPSS, Stata, SAS, R, CSV) son aptos para investigación no comercial, docencia y publicaciones." … "Se prohíbe la
            redistribución: volver a publicar datos del Latinobarómetro en otros sitios web infringe el derecho de propiedad de Latinobarómetro."
            <span className="about-quote-src">— Datos agregados por oleada (latinobarometro.org/agregados)</span>
          </blockquote>
          <blockquote className="about-quote">
            "El uso de datos sigue las mismas reglas que otros conjuntos de Latinobarómetro: libres para fines académicos no comerciales. La redistribución está prohibida."
            <span className="about-quote-src">— Serie temporal (latinobarometro.org/serie-temporal)</span>
          </blockquote>
          <p className="about-small">
            In English: the data may be used for non-commercial research, teaching and publications; redistribution is prohibited, and
            republishing Latinobarómetro data on other websites infringes Latinobarómetro's property rights. This site publishes only
            aggregate estimates (weighted percentages, means and correlations by country and year), never respondent-level data, and is a
            private preview for the research team. It should not be made public without written permission from the Corporación
            Latinobarómetro (latinobarometro@latinobarometro.org). Latinobarómetro's own online analysis tool is at{' '}
            <a href="https://www.latinobarometro.org/analisis-online" target="_blank" rel="noopener noreferrer">latinobarometro.org/analisis-online</a>.
          </p>
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
