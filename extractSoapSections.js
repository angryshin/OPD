function extractSoapSections(responseText) {
    const sMatch = responseText.match(/S \(Subjective\):\s*```([\s\S]*?)```/);
    const pMatch = responseText.match(/P \(Plan\):\s*```([\s\S]*?)```/);

    return {
        subjective: sMatch && sMatch[1] ? sMatch[1].trim() : null,
        plan: pMatch && pMatch[1] ? pMatch[1].trim() : null,
    };
}

module.exports = { extractSoapSections };
