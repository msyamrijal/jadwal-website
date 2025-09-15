 function loadData() {
  const spreadsheetUrl = "PASTE_URL_SPREADSHEET_ANDA_DI_SINI";

  fetch(spreadsheetUrl)
  .then(response => response.text())
  .then(csvData => {
  const data = parseCSV(csvData);
  populateTable(data);
  })
  .catch(error => console.error("Error fetching data:", error));
 }

 function parseCSV(csvData) {
  const lines = csvData.split("\n");
  const headers = lines[0].split(",").map(header => header.trim());
  const data = [];

  for (let i = 1; i < lines.length; i++) {
  const values = lines[i].split(",").map(value => value.trim());
  if (values.length === headers.length) {
  const entry = {};
  for (let j = 0; j < headers.length; j++) {
  entry[headers[j]] = values[j];
  }
  data.push(entry);
  }
  }

  return data;
 }

 function populateTable(data) {
  const tableBody = document.querySelector("#jadwal-table tbody");

  data.forEach(row => {
  const tr = document.createElement("tr");

  const id = document.createElement("td");
  id.textContent = row.ID;
  tr.appendChild(id);

  const institusi = document.createElement("td");
  institusi.textContent = row.Institusi;
  tr.appendChild(institusi);

  const mataPelajaran = document.createElement("td");
  mataPelajaran.textContent = row.Mata_Pelajaran;
  tr.appendChild(mataPelajaran);

  const tanggal = document.createElement("td");
  tanggal.textContent = row.Tanggal;
  tr.appendChild(tanggal);

  const materiDiskusi = document.createElement("td");
  materiDiskusi.textContent = row.Materi_Diskusi;
  tr.appendChild(materiDiskusi);
  
  let peserta = "";
  for(let i = 1; i <= 10; i++){
  if(row["Peserta " + i]){
  peserta += row["Peserta " + i] + ", ";
  }
  }

  const pesertaTd = document.createElement("td");
  pesertaTd.textContent = peserta.slice(0, -2);
  tr.appendChild(pesertaTd);

  tableBody.appendChild(tr);
  });
 }

 document.addEventListener("DOMContentLoaded", loadData);
