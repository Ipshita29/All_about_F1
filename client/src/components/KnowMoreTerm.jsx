function KnowMoreTerm({ term, children, setSelectedTerm, knowMoreInfo }) {
  return (
    <span className="know-more" onClick={() => setSelectedTerm(knowMoreInfo[term])}>
        {children}
    </span>
  );
}

export default KnowMoreTerm;
