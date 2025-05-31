// src/UploadExcel.jsx
import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { utils, writeFile } from 'xlsx';

function UploadExcel() {
  const [data, setData] = useState([]);
  const [tierFilter, setTierFilter] = useState('All');

  const getTier = (freq) => {
    if (freq > 10000) return 'Scalping';
    if (freq > 1000) return 'Swing';
    return 'BSJP';
  };

  const getStatus = (close, high) => {
    const target = close * 1.05;
    return high >= target ? 'Hit' : 'Waspada';
  };

  const generateAIDescription = async (tier, kode, persen) => {
    const prompt = `Klasifikasikan saham ${kode} dengan kenaikan ${persen}% dan kategori ${tier} sebagai salah satu dari: High Risk, Moderate Risk, atau Low Risk. Jawab hanya dengan salah satu kategori.`;

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": "Bearer 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",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "mistralai/mistral-7b-instruct",
          messages: [{ role: "user", content: prompt }]
        })
      });
      const result = await response.json();
      const content = result?.choices?.[0]?.message?.content || '';
      const clean = content.match(/(High Risk|Moderate Risk|Low Risk)/i);
      return clean ? clean[0] : 'Tidak dikenali';
    } catch (err) {
      console.error("AI error:", err);
      return 'Tidak dikenali';
    }
  };

  const handleFile = async (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();

    reader.onload = async (evt) => {
      const workbook = XLSX.read(evt.target.result, { type: 'binary' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet);

      const enriched = await Promise.all(
        json.map(async (row) => {
          const freq = Number(row.Freq) || 0;
          const close = Number(row.Close) || 1;
          const high = Number(row.High) || 1;

          const tier = getTier(freq);
          const status = getStatus(close, high);
          if (status !== 'Hit') return null;

          const persen = ((high - close) / close) * 100;
          const ai = await generateAIDescription(tier, row.Code, persen.toFixed(2));

          return {
            Emiten: row.Code,
            Close: close,
            High: high,
            Volume: row.Volume,
            Freq: freq,
            'Persen (%)': persen.toFixed(2),
            Status: status,
            Tier: tier,
            Sinyal: 'Buy',
            'Description AI': ai
          };
        })
      );

      const valid = enriched.filter(Boolean);
      const ranked = valid
        .sort((a, b) => b['Persen (%)'] - a['Persen (%)'])
        .map((item, i) => ({ ...item, Rank: i + 1 }));

      setData(ranked);
    };

    reader.readAsBinaryString(file);
  };

  const exportToExcel = () => {
    const ws = utils.json_to_sheet(data);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Dashboard");
    writeFile(wb, "dashboard-saham.xlsx");
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>📊 SantapanCuanku-ML x AI (v1.0.0)</h2>
      <input type="file" onChange={handleFile} />

      {data.length > 0 && (
        <>
          <div style={{ margin: '10px 0' }}>
            <label>Filter Tier: </label>
            <select value={tierFilter} onChange={(e) => setTierFilter(e.target.value)}>
              <option value="All">All</option>
              <option value="Scalping">Scalping</option>
              <option value="Swing">Swing</option>
              <option value="BSJP">BSJP</option>
            </select>
          </div>

          <button onClick={exportToExcel} style={{ marginBottom: 10 }}>
            📥 Export to Excel
          </button>

          <table border="1" cellPadding="5">
            <thead>
              <tr>
                {Object.keys(data[0]).map((key) => (
                  <th key={key}>{key}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data
                .filter(row => tierFilter === 'All' || row.Tier === tierFilter)
                .map((row, idx) => (
                  <tr key={idx}>
                    {Object.values(row).map((val, j) => (
                      <td key={j}>{val}</td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

export default UploadExcel;
