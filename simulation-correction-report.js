/* PDF-Export für Schüler-Testsimulationen – eigene Punktwerte werden ausschließlich
   aus dem gespeicherten Serverergebnis übernommen; keine Nachbewertung im Browser. */
(function(global){
"use strict";
const MARGIN=12;
const COLOR={
  good:{fill:[231,248,237],text:[8,122,55]},
  partial:{fill:[255,242,216],text:[169,88,0]},
  bad:{fill:[253,235,234],text:[180,35,24]}
};
function number(value){const n=Number(value);return Number.isFinite(n)?n:0}
function points(value){const n=number(value);return Number.isInteger(n)?String(n):String(n).replace(".",",")}
function val(value){const s=String(value??"").trim();return s||"–"}
function grading(value){const n=number(value);return n>=1?"good":n>0?"partial":"bad"}
function noControl(value){return String(value??"").replace(/[\x00-\x1f]/g," ")}
function titleBlock(doc,kind,result){
 const isGrammar=kind==="grammar",summary=result.summary||{};
 const title=isGrammar?"Grammatik-Testsimulation":"Vokabel-Testsimulation";
 doc.setFont("helvetica","bold");doc.setFontSize(17);doc.setTextColor(23,32,51);
 doc.text(title+" – Auswertung",MARGIN,19);
 doc.setFont("helvetica","normal");doc.setFontSize(9);doc.setTextColor(71,85,105);
 doc.text("Korrektur wie im regulären Test · "+new Date().toLocaleDateString("de-DE"),MARGIN,25);
 doc.setFillColor(241,245,249);doc.roundedRect(MARGIN,30,210-2*MARGIN,16,2,2,"F");
 const labels=[
  "Punkte: "+points(summary.rawPoints)+" / "+points(summary.maxPoints),
  "Prozent: "+number(summary.percent).toFixed(1).replace(".",",")+" %",
  "Note: "+val(summary.gradeText),
  "Oberstufenpunkte: "+points(summary.upperSchoolPoints)
 ];
 doc.setFont("helvetica","bold");doc.setFontSize(9);doc.setTextColor(23,32,51);
 const widths=[53,39,43,49],positions=[16,69,108,151];
 for(let i=0;i<labels.length;i++)doc.text(noControl(labels[i]),positions[i],39,{maxWidth:widths[i]});
 doc.setFont("helvetica","normal");doc.setFontSize(8);doc.setTextColor(71,85,105);
 doc.text("Grün = richtig     Orange = teilweise richtig     Rot = falsch",MARGIN,52);
 return 57;
}
function scoreStyle(data,pointsForRow,answerColumn,wholeRow=false){
 if(data.section!=="body")return;
 const value=pointsForRow[data.row.index];
 const key=grading(value),colors=COLOR[key];
 if(wholeRow||data.column.index===answerColumn){
   data.cell.styles.fillColor=colors.fill;
   data.cell.styles.textColor=colors.text;
   if(data.column.index===answerColumn)data.cell.styles.fontStyle="bold";
 }
}
function tableCommon(doc){
 return {
  theme:"grid",
  margin:{left:MARGIN,right:MARGIN,top:15,bottom:16},
  styles:{font:"helvetica",fontSize:8.4,cellPadding:2.1,lineColor:[203,213,225],lineWidth:.15,overflow:"linebreak",valign:"top",textColor:[23,32,51]},
  headStyles:{fillColor:[238,242,247],textColor:[51,65,85],fontStyle:"bold",lineColor:[203,213,225]},
  alternateRowStyles:{fillColor:[255,255,255]},
  showHead:"everyPage",
  pageBreak:"auto"
 };
}
function vocab(doc,corrections,y){
 const rows=corrections.map(item=>[
   String(item.position??""),
   noControl(val(item.sourceText)),
   noControl(val(item.responseText)),
   noControl((item.acceptedAnswers||[]).join(" / ")||"–"),
   points(item.points)+" / 1"
 ]);
 const scores=corrections.map(item=>number(item.points));
 doc.autoTable({...tableCommon(doc),startY:y,head:[["Nr.","Deutsch","Schülerantwort","Richtige Lösung","Punkte"]],body:rows,
  columnStyles:{0:{cellWidth:11},1:{cellWidth:42},2:{cellWidth:45},3:{cellWidth:63},4:{cellWidth:25}},
  didParseCell:data=>scoreStyle(data,scores,2,true)
 });
 return doc.lastAutoTable.finalY+8;
}
function grammar(doc,corrections,y){
 for(const q of corrections){
  const parts=[{label:"Deutsche Bedeutung",typed:q.translation,expected:q.expectedTranslation,score:q.translationPoint}];
  (q.labels||[]).forEach((lab,i)=>parts.push({label:lab,typed:q.forms?.[i],expected:q.expectedForms?.[i],score:q.formPoints?.[i]}));
  const labels=parts.map(p=>number(p.score));
  const header="Aufgabe "+val(q.position)+" · "+val(q.sourceText);
  const subheading=[q.topicGroup,q.topicTitle].filter(Boolean).join(" · ")||val(q.mode);
  const lines=doc.splitTextToSize(noControl(header),186);
  const required=Math.min(34,6+lines.length*5);
  if(y+required>275){doc.addPage();y=17}
  doc.setFont("helvetica","bold");doc.setFontSize(11);doc.setTextColor(23,32,51);
  doc.text(lines,MARGIN,y);y+=Math.max(5,lines.length*5);
  doc.setFont("helvetica","normal");doc.setFontSize(8);doc.setTextColor(100,116,139);
  doc.text(noControl(subheading),MARGIN,y,{maxWidth:144});
  doc.setFont("helvetica","bold");doc.setTextColor(23,32,51);
  doc.text(points(q.points)+" / "+points(q.maxPoints)+" P.",198,y,{align:"right"});
  y+=3;
  doc.autoTable({...tableCommon(doc),startY:y,head:[["Teil","Schülerantwort","Richtige Lösung","Punkte"]],body:parts.map(part=>[
   noControl(part.label),noControl(val(part.typed)),noControl(val(part.expected)),points(part.score)+" / 1"
  ]),
  columnStyles:{0:{cellWidth:45},1:{cellWidth:54},2:{cellWidth:62},3:{cellWidth:25}},
  didParseCell:data=>scoreStyle(data,labels,1)
  });
  y=doc.lastAutoTable.finalY+9;
 }
 return y;
}
function gradeScale(doc,y){
 const rows=[
  ["15","95–100 %","7","55–<60 %"],["14","90–<95 %","6","50–<55 %"],
  ["13","85–<90 %","5","45–<50 %"],["12","80–<85 %","4","39–<45 %"],
  ["11","75–<80 %","3","33–<39 %"],["10","70–<75 %","2","27–<33 %"],
  ["9","65–<70 %","1","20–<27 %"],["8","60–<65 %","0","0–<20 %"]
 ];
 if(y>215){doc.addPage();y=17}
 doc.setFont("helvetica","bold");doc.setFontSize(11);doc.setTextColor(23,32,51);
 doc.text("Umrechnung in Oberstufenpunkte",MARGIN,y);y+=4;
 doc.autoTable({...tableCommon(doc),startY:y,
  head:[["Punkte","Erreichte Prozent","Punkte","Erreichte Prozent"]],body:rows,
  styles:{...tableCommon(doc).styles,fontSize:7.5,cellPadding:1.35},
  columnStyles:{0:{cellWidth:26},1:{cellWidth:67},2:{cellWidth:26},3:{cellWidth:67}}
 });
}
function download(kind,result){
 if(!result?.summary)throw new Error("Es liegt noch kein ausgewertetes Simulationsergebnis vor.");
 const JsPdf=global.jspdf?.jsPDF;
 if(typeof JsPdf!=="function")throw new Error("PDF-Bibliothek nicht geladen. Bitte die Druckfunktion verwenden.");
 const doc=new JsPdf({orientation:"portrait",unit:"mm",format:"a4",compress:true});
 if(typeof doc.autoTable!=="function")throw new Error("PDF-Tabellenbibliothek nicht geladen. Bitte die Druckfunktion verwenden.");
 let y=titleBlock(doc,kind,result);
 const corrections=Array.isArray(result.corrections)?result.corrections:[];
 y=kind==="grammar"?grammar(doc,corrections,y):vocab(doc,corrections,y);
 gradeScale(doc,y);
 const pages=doc.internal.getNumberOfPages();
 for(let page=1;page<=pages;page++){
  doc.setPage(page);doc.setFont("helvetica","normal");doc.setFontSize(8);doc.setTextColor(100,116,139);
  doc.text("Avanza · Testsimulation",MARGIN,288);
  doc.text("Seite "+page+" / "+pages,198,288,{align:"right"});
 }
 const date=new Date().toISOString().slice(0,10);
 doc.save("Avanza_"+(kind==="grammar"?"Grammatik":"Vokabeln")+"_Testsimulation_"+date+".pdf");
}
global.AvanzaSimulationReport={download};
})(window);
