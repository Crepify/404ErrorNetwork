// Refresh an untouched earlier AgriPulse placeholder, never custom writing.
const PREVIOUS="AgriPulse was our project for the NexHack hackathon at IITM Delhi. We were shortlisted and travelled to Delhi, but narrowly missed making the elimination round.";
const UPDATE={
  "description": "AgriPulse was our agritech app project for NexHack at IITM Delhi. It aimed to bring leaf scanning, a central marketplace for farmers to sell their crops, and other supporting features into one app.",
  "problemStatement": "We wanted to support farmers with leaf-scanning tools and a central place to sell their crops. However, we had not researched the problem deeply enough or resolved important questions about trust among rural farmers and how the app would fit their real-world needs.",
  "idealSolution": "Our ideal was one app where farmers could scan leaves, sell their crops in a central marketplace and access supporting features. Making that idea workable would require a focused scope, a clear understanding of farmer needs, trust, and careful attention to loopholes, security and real-world edge cases.",
  "lessonsLearned": "Looking back, we tried to cover too many broad and demanding use cases without enough research. We had unresolved ambiguities around rural farmers’ trust and had not thought through the many loopholes, risks and safeguards an agritech app needs. We see those gaps as reasons the project did not work out and our hackathon attempt fell short.\n\nOur biggest lesson: research as thoroughly as possible before building. Talk to mentors and other people about the project, challenge assumptions, understand real users and narrow the scope before committing to implementation."
};
export function refreshUntouchedAgriPulse(p){
 if(p.id==='agripulse'&&p.description===PREVIOUS&&!p.problemStatement&&!p.idealSolution&&!p.lessonsLearned)Object.assign(p,UPDATE);
 return p;
}
