const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const transcriptTextarea = document.getElementById('transcript');
const summarizeButton = document.getElementById('summarizeButton');
const subjectiveOutput = document.getElementById('subjectiveOutput').querySelector('code');
const planOutput = document.getElementById('planOutput').querySelector('code');
const apiKeyInput = document.getElementById('apiKey');
const clearButton = document.getElementById('clearButton');
const copyButton = document.getElementById('copyButton');
const saveButton = document.getElementById('saveButton');
const clearAllButton = document.getElementById('clearAllButton');

// Buttons for Subjective Output
const clearSubjectiveButton = document.getElementById('clearSubjectiveButton');
const copySubjectiveButton = document.getElementById('copySubjectiveButton');
const saveSubjectiveButton = document.getElementById('saveSubjectiveButton');

// Buttons for Plan Output
const clearPlanButton = document.getElementById('clearPlanButton');
const copyPlanButton = document.getElementById('copyPlanButton');
const savePlanButton = document.getElementById('savePlanButton');

// Recording status elements
const recordingStatus = document.getElementById('recordingStatus');
const statusText = document.getElementById('statusText');
const recordingTime = document.getElementById('recordingTime');

let recognition;
let recognizing = false;
let finalTranscript = '';
let restartRecognition = false; // 자동 재시작 플래그
let recognitionTimeout; // 타임아웃 핸들러
let recordingStartTime; // 녹음 시작 시간
let recordingTimer; // 녹음 시간 타이머

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
    
    // 추가 설정으로 안정성 향상
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
        recognizing = true;
        startButton.disabled = true;
        stopButton.disabled = false;
        summarizeButton.disabled = true;
        transcriptTextarea.placeholder = '음성 인식 중...';
        finalTranscript = transcriptTextarea.value; // Preserve existing text
        
        // 상태 표시 업데이트
        statusText.textContent = '녹음 중';
        recordingStatus.classList.add('active');
        recordingStartTime = Date.now();
        recordingTimer = setInterval(updateRecordingTime, 1000);
        
        // 15분(900초) 후 자동 재시작 설정
        recognitionTimeout = setTimeout(() => {
            if (recognizing) {
                console.log('음성 인식을 자동으로 재시작합니다.');
                restartRecognition = true;
                recognition.stop();
            }
        }, 900000); // 15분
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        
        // 에러 타입에 따른 처리
        let errorMessage = '';
        switch(event.error) {
            case 'network':
                errorMessage = '네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.';
                break;
            case 'audio-capture':
                errorMessage = '마이크에 접근할 수 없습니다. 마이크 권한을 확인해주세요.';
                break;
            case 'not-allowed':
                errorMessage = '마이크 권한이 거부되었습니다. 브라우저 설정에서 마이크 권한을 허용해주세요.';
                break;
            case 'no-speech':
                errorMessage = '음성이 감지되지 않았습니다. 다시 시도해주세요.';
                // no-speech 에러는 자동 재시작
                if (recognizing) {
                    restartRecognition = true;
                    recognition.stop();
                    return;
                }
                break;
            case 'service-not-allowed':
                errorMessage = '음성 인식 서비스가 허용되지 않았습니다.';
                break;
            default:
                errorMessage = `오류: ${event.error}. 마이크 권한을 확인하거나 다른 브라우저를 사용해보세요.`;
        }
        
        transcriptTextarea.placeholder = errorMessage;
        
        // 자동 재시작하지 않는 경우에만 UI 상태 변경
        if (!restartRecognition) {
            recognizing = false;
            startButton.disabled = false;
            stopButton.disabled = true;
            summarizeButton.disabled = transcriptTextarea.value.trim() === '';
            
            // 상태 표시 업데이트
            statusText.textContent = '대기 중';
            recordingStatus.classList.remove('active');
            if (recordingTimer) {
                clearInterval(recordingTimer);
                recordingTimer = null;
            }
            recordingTime.textContent = '';
        }
        
        if (recognitionTimeout) {
            clearTimeout(recognitionTimeout);
        }
    };

    recognition.onend = () => {
        console.log('음성 인식이 종료되었습니다.');
        
        if (recognitionTimeout) {
            clearTimeout(recognitionTimeout);
        }
        
        // 자동 재시작이 필요한 경우
        if (restartRecognition && recognizing) {
            console.log('음성 인식을 재시작합니다...');
            setTimeout(() => {
                if (recognizing && restartRecognition) {
                    try {
                        recognition.start();
                        restartRecognition = false;
                    } catch (e) {
                        console.error('음성 인식 재시작 실패:', e);
                        recognizing = false;
                        restartRecognition = false;
                        startButton.disabled = false;
                        stopButton.disabled = true;
                        transcriptTextarea.placeholder = '음성 인식 재시작에 실패했습니다. 다시 시도해주세요.';
                    }
                }
            }, 1000); // 1초 후 재시작
            return;
        }
        
        // 정상 종료인 경우
        recognizing = false;
        restartRecognition = false;
        startButton.disabled = false;
        stopButton.disabled = true;
        summarizeButton.disabled = transcriptTextarea.value.trim() === '';
        transcriptTextarea.placeholder = '음성 인식 결과가 여기에 표시됩니다...';
        if (finalTranscript.length > 0) {
            transcriptTextarea.value = finalTranscript;
        }
        
        // 상태 표시 업데이트
        statusText.textContent = '대기 중';
        recordingStatus.classList.remove('active');
        if (recordingTimer) {
            clearInterval(recordingTimer);
            recordingTimer = null;
        }
        recordingTime.textContent = '';
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
    restartRecognition = false; // 수동 시작시 자동 재시작 플래그 초기화
    try {
        recognition.start();
    } catch (e) {
        console.error('음성 인식 시작 실패:', e);
        alert('음성 인식을 시작할 수 없습니다. 잠시 후 다시 시도해주세요.');
    }
});

stopButton.addEventListener('click', () => {
    if (!recognizing) return;
    restartRecognition = false; // 수동 중지시 자동 재시작 방지
    if (recognitionTimeout) {
        clearTimeout(recognitionTimeout);
    }
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
- 각 항목은 별도의 코드 블록( \`\`\` ) 안에 작성해 copy & paste가 용이하도록 합니다.
- 각 bullet 사이에는 빈 줄 없이 붙여서 작성합니다.

### 대화 내용 ###
${transcript}

### 요약 결과 ###
S (Subjective):
\`\`\`
[여기에 S 항목 요약]
\`\`\`

P (Plan):
\`\`\`
[여기에 P 항목 요약]
\`\`\`
    `;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`, {
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
            throw new Error(`API 요청 실패: ${response.status} ${response.statusText}. ${errorData.error?.message || ''}`);
        }

        const data = await response.json();
        
        if (data.candidates && data.candidates.length > 0 && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts.length > 0) {
            const fullResponse = data.candidates[0].content.parts[0].text;
            console.log("Full API Response:", fullResponse);

            // Extract S and P sections using more robust regex
            const sMatch = fullResponse.match(/S \(Subjective\):\s*\`\`\`([\s\S]*?)\`\`\`/);
            const pMatch = fullResponse.match(/P \(Plan\):\s*\`\`\`([\s\S]*?)\`\`\`/);

            subjectiveOutput.textContent = sMatch && sMatch[1] ? sMatch[1].trim() : 'S 항목을 추출하지 못했습니다.';
            planOutput.textContent = pMatch && pMatch[1] ? pMatch[1].trim() : 'P 항목을 추출하지 못했습니다.';

        } else {
            console.error('Invalid API response structure:', data);
            subjectiveOutput.textContent = '요약 결과를 가져오지 못했습니다. 응답 형식이 올바르지 않습니다.';
            planOutput.textContent = '요약 결과를 가져오지 못했습니다. 응답 형식이 올바르지 않습니다.';
        }

    } catch (error) {
        console.error('Error during summarization:', error);
        subjectiveOutput.textContent = `오류: ${error.message}`;
        planOutput.textContent = `오류: ${error.message}`;
    }

    summarizeButton.disabled = false;
    summarizeButton.textContent = 'SOAP 요약 (S & P)';
});

clearButton.addEventListener('click', () => {
    transcriptTextarea.value = '';
    finalTranscript = ''; // Reset finalTranscript as well
    summarizeButton.disabled = true;
    transcriptTextarea.placeholder = '음성 인식 결과가 여기에 표시됩니다...';
});

copyButton.addEventListener('click', () => {
    const textToCopy = transcriptTextarea.value;
    if (!textToCopy) {
        alert('복사할 내용이 없습니다.');
        return;
    }
    navigator.clipboard.writeText(textToCopy)
        .then(() => {
            alert('대화 내용이 클립보드에 복사되었습니다.');
        })
        .catch(err => {
            console.error('Failed to copy text: ', err);
            alert('내용 복사에 실패했습니다. 콘솔을 확인해주세요.');
        });
});

saveButton.addEventListener('click', () => {
    const textToSave = transcriptTextarea.value;
    if (!textToSave) {
        alert('저장할 내용이 없습니다.');
        return;
    }
    const filename = `transcript_${new Date().toISOString().replace(/[-:.]/g, "").replace("T", "_").slice(0,15)}.txt`;
    const blob = new Blob([textToSave], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href); // Clean up
});

// --- Subjective Output Actions ---
clearSubjectiveButton.addEventListener('click', () => {
    subjectiveOutput.textContent = '요약 결과가 여기에 표시됩니다.';
});

copySubjectiveButton.addEventListener('click', () => {
    const textToCopy = subjectiveOutput.textContent;
    if (!textToCopy || textToCopy === '요약 결과가 여기에 표시됩니다.') {
        alert('복사할 S 내용이 없습니다.');
        return;
    }
    navigator.clipboard.writeText(textToCopy)
        .then(() => {
            alert('S (Subjective) 내용이 클립보드에 복사되었습니다.');
        })
        .catch(err => {
            console.error('Failed to copy S text: ', err);
            alert('S 내용 복사에 실패했습니다. 콘솔을 확인해주세요.');
        });
});

saveSubjectiveButton.addEventListener('click', () => {
    const textToSave = subjectiveOutput.textContent;
    if (!textToSave || textToSave === '요약 결과가 여기에 표시됩니다.') {
        alert('저장할 S 내용이 없습니다.');
        return;
    }
    const filename = `subjective_summary_${new Date().toISOString().replace(/[-:.]/g, "").replace("T", "_").slice(0,15)}.txt`;
    const blob = new Blob([textToSave], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
});

// --- Plan Output Actions ---
clearPlanButton.addEventListener('click', () => {
    planOutput.textContent = '요약 결과가 여기에 표시됩니다.';
});

copyPlanButton.addEventListener('click', () => {
    const textToCopy = planOutput.textContent;
    if (!textToCopy || textToCopy === '요약 결과가 여기에 표시됩니다.') {
        alert('복사할 P 내용이 없습니다.');
        return;
    }
    navigator.clipboard.writeText(textToCopy)
        .then(() => {
            alert('P (Plan) 내용이 클립보드에 복사되었습니다.');
        })
        .catch(err => {
            console.error('Failed to copy P text: ', err);
            alert('P 내용 복사에 실패했습니다. 콘솔을 확인해주세요.');
        });
});

savePlanButton.addEventListener('click', () => {
    const textToSave = planOutput.textContent;
    if (!textToSave || textToSave === '요약 결과가 여기에 표시됩니다.') {
        alert('저장할 P 내용이 없습니다.');
        return;
    }
    const filename = `plan_summary_${new Date().toISOString().replace(/[-:.]/g, "").replace("T", "_").slice(0,15)}.txt`;
    const blob = new Blob([textToSave], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
});

// --- Clear All Action ---
clearAllButton.addEventListener('click', () => {
    // Clear transcript area
    transcriptTextarea.value = '';
    finalTranscript = '';
    summarizeButton.disabled = true;
    transcriptTextarea.placeholder = '음성 인식 결과가 여기에 표시됩니다...';

    // Clear Subjective output
    subjectiveOutput.textContent = '요약 결과가 여기에 표시됩니다.';

    // Clear Plan output
    planOutput.textContent = '요약 결과가 여기에 표시됩니다.';

    alert('모든 내용이 지워졌습니다.');
});

// Enable summarize button if there's text on load
if (transcriptTextarea.value.trim() !== '') {
    summarizeButton.disabled = false;
}

// 녹음 시간 포맷팅 함수
function formatRecordingTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// 녹음 시간 업데이트 함수
function updateRecordingTime() {
    if (recordingStartTime) {
        const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
        recordingTime.textContent = formatRecordingTime(elapsed);
    }
} 