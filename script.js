const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const transcriptTextarea = document.getElementById('transcript');
const summarizeButton = document.getElementById('summarizeButton');
const subjectiveOutput = document.getElementById('subjectiveOutput').querySelector('code');
const planOutput = document.getElementById('planOutput').querySelector('code');
const apiKeyInput = document.getElementById('apiKey');

let recognition;
let recognizing = false;
let finalTranscript = '';

// Load API Key from local storage
apiKeyInput.value = localStorage.getItem('geminiApiKey') || '';
apiKeyInput.addEventListener('input', () => {
    localStorage.setItem('geminiApiKey', apiKeyInput.value);
});

if ('webkitSpeechRecognition' in window) {
    recognition = new webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'ko-KR';

    recognition.onstart = () => {
        recognizing = true;
        startButton.disabled = true;
        stopButton.disabled = false;
        summarizeButton.disabled = true;
        transcriptTextarea.placeholder = '음성 인식 중...';
        finalTranscript = transcriptTextarea.value; // Preserve existing text
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        transcriptTextarea.placeholder = `오류: ${event.error}. 마이크 권한을 확인하거나 다른 브라우저를 사용해보세요.`;
        recognizing = false;
        startButton.disabled = false;
        stopButton.disabled = true;
        summarizeButton.disabled = transcriptTextarea.value.trim() === '';
    };

    recognition.onend = () => {
        recognizing = false;
        startButton.disabled = false;
        stopButton.disabled = true;
        summarizeButton.disabled = transcriptTextarea.value.trim() === '';
        transcriptTextarea.placeholder = '음성 인식 결과가 여기에 표시됩니다...';
        if (finalTranscript.length > 0) {
            transcriptTextarea.value = finalTranscript;
        }
    };

    recognition.onresult = (event) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript + '\n'; // Add newline after each final segment
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }
        transcriptTextarea.value = finalTranscript + interimTranscript;
        summarizeButton.disabled = transcriptTextarea.value.trim() === '';
    };

} else {
    startButton.disabled = true;
    transcriptTextarea.placeholder = '이 브라우저에서는 음성 인식을 지원하지 않습니다. Chrome 브라우저를 사용해보세요.';
    alert('이 브라우저에서는 음성 인식을 지원하지 않습니다. Chrome 브라우저를 사용해보세요.');
}

startButton.addEventListener('click', () => {
    if (recognizing) return;
    if (!apiKeyInput.value.trim()) {
        alert('Gemini API 키를 입력해주세요.');
        apiKeyInput.focus();
        return;
    }
    finalTranscript = transcriptTextarea.value; // Start with current content if any
    if (finalTranscript.length > 0 && !finalTranscript.endsWith('\n')) {
        finalTranscript += '\n'; // Ensure newline if starting from existing text
    }
    recognition.start();
});

stopButton.addEventListener('click', () => {
    if (!recognizing) return;
    recognition.stop();
});

summarizeButton.addEventListener('click', async () => {
    const transcript = transcriptTextarea.value.trim();
    if (!transcript) {
        alert('요약할 대화 내용이 없습니다.');
        return;
    }

    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
        alert('Gemini API 키를 입력해주세요.');
        apiKeyInput.focus();
        return;
    }

    summarizeButton.disabled = true;
    summarizeButton.textContent = '요약 중...';
    subjectiveOutput.textContent = '요청 중...';
    planOutput.textContent = '요청 중...';

    const prompt = `
### Instruction ###
당신은 의료 기록 전문가입니다. 아래에 외래 진료 중 의사와 환자의 대화가 주어집니다. 이 대화를 바탕으로 SOAP 형식 중 다음 두 항목만 간결하고 전문적으로 요약하세요.

- S (Subjective): 환자가 직접 호소하거나 표현한 증상, 불편, 감정, 병력 등 주관적 정보
- P (Plan): 의사가 설명하거나 계획한 검사 결과, 치료 또는 약물 계획, 교육, 추후 진료 등 치료 방침

※ 작성 지침:
- 각 항목은 짧고 명료한 bullet 형식으로 요약합니다.
- 불필요하거나 반복적인 문장은 생략합니다.
- 개인정보는 일반화하거나 가명 처리합니다.
- 의사와 환자의 발화를 구분하여 분석하고 요약합니다.
- 검사 수치 및 의학적 정보는 구체적으로 기술합니다.
- 출력 형식은 아래 예시와 동일하게 작성합니다.

※ 출력 형식:
- 각 항목은 별도의 코드 블록( \\\`\\\`\\\` ) 안에 작성해 copy & paste가 용이하도록 합니다.
- 각 bullet 사이에는 빈 줄 없이 붙여서 작성합니다.

### 대화 내용 ###
${transcript}

### 요약 결과 ###
S (Subjective):
\\\`\\\`\\\`
[여기에 S 항목 요약]
\\\`\\\`\\\`

P (Plan):
\\\`\\\`\\\`
[여기에 P 항목 요약]
\\\`\\\`\\\`
    `;

    try {
        const response = await fetch(\`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}\`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.3, // Lower temperature for more deterministic and concise summaries
                    topK: 1,
                    topP: 1,
                    maxOutputTokens: 1024,
                }
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('API Error:', errorData);
            throw new Error(\`API 요청 실패: ${response.status} ${response.statusText}. ${errorData.error?.message || ''}\`);
        }

        const data = await response.json();
        
        if (data.candidates && data.candidates.length > 0 && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts.length > 0) {
            const fullResponse = data.candidates[0].content.parts[0].text;
            console.log("Full API Response:", fullResponse);

            // Extract S and P sections using more robust regex
            const sMatch = fullResponse.match(/S \\(Subjective\\):\\s*\\\`\\\`\\\`([\\s\\S]*?)\\\`\\\`\\\`/);
            const pMatch = fullResponse.match(/P \\(Plan\\):\\s*\\\`\\\`\\\`([\\s\\S]*?)\\\`\\\`\\\`/);

            subjectiveOutput.textContent = sMatch && sMatch[1] ? sMatch[1].trim() : 'S 항목을 추출하지 못했습니다.';
            planOutput.textContent = pMatch && pMatch[1] ? pMatch[1].trim() : 'P 항목을 추출하지 못했습니다.';

        } else {
            console.error('Invalid API response structure:', data);
            subjectiveOutput.textContent = '요약 결과를 가져오지 못했습니다. 응답 형식이 올바르지 않습니다.';
            planOutput.textContent = '요약 결과를 가져오지 못했습니다. 응답 형식이 올바르지 않습니다.';
        }

    } catch (error) {
        console.error('Error during summarization:', error);
        subjectiveOutput.textContent = \`오류: ${error.message}\`;
        planOutput.textContent = \`오류: ${error.message}\`;
    }

    summarizeButton.disabled = false;
    summarizeButton.textContent = 'SOAP 요약 (S & P)';
});

// Enable summarize button if there's text on load
if (transcriptTextarea.value.trim() !== '') {
    summarizeButton.disabled = false;
} 