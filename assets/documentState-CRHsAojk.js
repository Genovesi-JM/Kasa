var e=`.pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.md,.csv`,t={empty:`The file is empty.`,fileTooLarge:`The file exceeds the 10 MB limit.`,unsupportedFormat:`Choose a PDF, PNG, JPEG, GIF, WebP, TXT, MD or CSV file.`,unavailableCategory:`Choose a category available in this workspace.`,alreadyAdded:`This file is already in this workspace.`,workspaceFull:`This workspace has reached its 50 MB local-file limit.`,nothingToRestore:`There is no document to restore.`,restoreDuplicate:`That file is already in this workspace.`,restoreFull:`Remove another local file to make space before restoring this one.`};function n(e){let n=t[e.code];return e.fileName===void 0?n:`${e.fileName}: ${n}`}var r={pdf:{kind:`pdf`,mimeType:`application/pdf`,acceptedTypes:[`application/pdf`]},png:{kind:`image`,mimeType:`image/png`,acceptedTypes:[`image/png`]},jpg:{kind:`image`,mimeType:`image/jpeg`,acceptedTypes:[`image/jpeg`]},jpeg:{kind:`image`,mimeType:`image/jpeg`,acceptedTypes:[`image/jpeg`]},gif:{kind:`image`,mimeType:`image/gif`,acceptedTypes:[`image/gif`]},webp:{kind:`image`,mimeType:`image/webp`,acceptedTypes:[`image/webp`]},txt:{kind:`text`,mimeType:`text/plain`,acceptedTypes:[`text/plain`]},md:{kind:`text`,mimeType:`text/plain`,acceptedTypes:[`text/plain`,`text/markdown`]},csv:{kind:`text`,mimeType:`text/plain`,acceptedTypes:[`text/plain`,`text/csv`]}};function i(e){return e===`tenant`?[`Lease & property`,`Rent & maintenance`,`Personal records`,`Other`]:e===`landlord`?[`Lease & property`,`Rent & maintenance`,`Other`]:e===`provider`?[`Service records`,`Other`]:e===`spaceOperator`?[`Venue records`,`Other`]:[`Platform records`,`Other`]}function a(){return{nextId:1,removed:{},records:Object.entries({tenant:[{name:`Example lease notes`,category:`Lease & property`,text:`A lease record can keep the property, start date, parties and agreed terms together.

This example is an explanatory note, not a lease contract. No signature or agreement is recorded.`},{name:`Move-in checklist example`,category:`Lease & property`,text:`Example checklist

• Review the condition of each room.
• Note which keys and access devices were provided.
• Agree how maintenance issues should be reported.

These are example headings. No property inspection has been completed.`},{name:`Rent record guide`,category:`Rent & maintenance`,text:`Kasa's rent records describe direct tenant-to-landlord transfers.

A receipt may be added to a record in a connected production service. This sample contains no bank details or payment receipt, and no payment has been confirmed.`}],landlord:[{name:`Property document checklist`,category:`Lease & property`,text:`Example checklist

• Property description and relevant certificates
• Agreed lease and handover records
• Maintenance history

This example does not certify that any document exists or has been checked.`},{name:`Maintenance handover example`,category:`Rent & maintenance`,text:`Example service record

Issue: describe the reported problem.
Visit: record the agreed time.
Outcome: note work completed and any follow-up.

No service visit or completed repair is represented by this sample.`}],provider:[{name:`Service visit checklist`,category:`Service records`,text:`Example checklist

• Review the customer's description.
• Agree the visit and scope directly.
• Record observations and agreed follow-up.

This sample is not a completed or certified service report.`}],spaceOperator:[{name:`Venue handover checklist`,category:`Venue records`,text:`Example checklist

• Confirm the reserved space and access arrangements.
• Review equipment and venue rules.
• Record any agreed follow-up.

This sample does not confirm a reservation, payment or inspection.`}],admin:[{name:`Document handling notes`,category:`Platform records`,text:`Sample operational notes

Production document handling needs access controls, retention rules and a secure storage service.

The current local library does not upload, verify, sign or deliver files. This sample contains no user document or verification decision.`}]}).flatMap(([e,t])=>t.map((t,n)=>({id:`sample-${e}-${n+1}`,role:e,name:t.name,category:t.category,addedAt:`2026-10-02T09:00:00.000Z`,source:`sample`,kind:`text`,content:`KASA — SAMPLE PREVIEW\n${t.name}\n\n${t.text}`})))}}function o(e,t){return e.records.filter(e=>e.role===t)}function s(e){return e.source===`local`?e.file.size:new TextEncoder().encode(e.content).length}function c(e,t){return o(e,t).reduce((e,t)=>e+(t.source===`local`?t.file.size:0),0)}function l(e){if(!Number.isFinite(e.size)||e.size<=0)return{code:`empty`};if(e.size>10485760)return{code:`fileTooLarge`};let t=e.name.split(`.`).at(-1)?.toLowerCase()??``,n=Object.hasOwn(r,t)?r[t]:void 0,i=e.type.toLowerCase().split(`;`)[0].trim();return!n||i&&!n.acceptedTypes.includes(i)?{code:`unsupportedFormat`}:null}function u(e){if(l(e))return null;let t=r[e.name.split(`.`).at(-1).toLowerCase()];return{kind:t.kind,mimeType:t.mimeType}}function d(e,t){return e.source===`local`&&e.file===t}function f(e,r,a,o,s=new Date){if(!i(r).includes(o))return{state:e,added:0,errors:[t.unavailableCategory],issues:[{code:`unavailableCategory`}]};let f=[...e.records],p=[],m=e.nextId,h=c(e,r);for(let e of a){let t=l(e);if(!t&&f.some(t=>t.role===r&&d(t,e))&&(t={code:`alreadyAdded`}),!t&&h+e.size>52428800&&(t={code:`workspaceFull`}),t){p.push({...t,fileName:e.name});continue}let n=u(e);f.push({id:`local-document-${m}`,role:r,name:e.name,category:o,addedAt:s.toISOString(),source:`local`,kind:n.kind,mimeType:n.mimeType,file:e}),m+=1,h+=e.size}let g=f.length-e.records.length;return{state:g?{...e,records:f,nextId:m}:e,added:g,errors:p.map(n),issues:p}}function p(e,t,n){let r=e.records.find(e=>e.role===t&&e.id===n);return r?{...e,records:e.records.filter(e=>e!==r),removed:{...e.removed,[t]:r}}:e}function m(e,t){let n=e.removed[t];if(!n||n.role!==t)return{code:`nothingToRestore`};if(n.source===`local`){if(o(e,t).some(e=>d(e,n.file)))return{code:`restoreDuplicate`};if(c(e,t)+n.file.size>52428800)return{code:`restoreFull`}}return null}function h(e,t){let r=m(e,t);return r?n(r):null}function g(e,t){if(h(e,t))return e;let n=e.removed[t];return{...e,records:[...e.records,n],removed:{...e.removed,[t]:void 0}}}export{s as a,p as c,o as d,c as f,a as i,g as l,f as n,u as o,i as r,l as s,e as t,m as u};