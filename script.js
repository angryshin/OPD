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
let restartRecognition = false;
let recognitionTimeout;
let recordingStartTime;
let recordingTimer;
let currentSpeaker = null;
let isRecording = false;
let pendingTranscript = '';
let transcriptBuffer = [];
let processingTimeout = null;

// 🔧 새로운 상태 관리 변수들
let speakerChangeRequested = false;
let pendingSpeaker = null;
let isProcessingTranscript = false;
let transcriptQueue = [];
let lastProcessedText = '';

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
    
    // 음성 인식 설정 최적화
    recognition.maxAlternatives = 3; // 대체 결과 수 증가
    recognition.interimResults = true; // 중간 결과 활성화

    recognition.onstart = () => {
        recognizing = true;
        isRecording = true;
        startButton.disabled = true;
        stopButton.disabled = false;
        summarizeButton.disabled = true;
        transcriptTextarea.placeholder = '음성 인식 중...';
        
        // 상태 표시 업데이트
        statusText.textContent = '녹음 중';
        recordingStatus.classList.add('active');
        recordingStartTime = Date.now();
        recordingTimer = setInterval(updateRecordingTime, 1000);
        
        // 🔧 상태 초기화
        speakerChangeRequested = false;
        pendingSpeaker = null;
        isProcessingTranscript = false;
        
        // 15분 후 자동 재시작 설정
        recognitionTimeout = setTimeout(() => {
            if (recognizing) {
                console.log('음성 인식을 자동으로 재시작합니다.');
                restartRecognition = true;
                recognition.stop();
            }
        }, 900000);
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
        
        if (!restartRecognition) {
            recognizing = false;
            startButton.disabled = false;
            stopButton.disabled = true;
            summarizeButton.disabled = transcriptTextarea.value.trim() === '';
            
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
        isRecording = false;
        
        // 🔧 개선된 pendingTranscript 처리
        if (pendingTranscript && !isProcessingTranscript) {
            processTranscriptSafely(pendingTranscript, true);
        }
        
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
            }, 1000);
            return;
        }
        
        // 정상 종료인 경우
        recognizing = false;
        restartRecognition = false;
        startButton.disabled = false;
        stopButton.disabled = true;
        summarizeButton.disabled = transcriptTextarea.value.trim() === '';
        transcriptTextarea.placeholder = '음성 인식 결과가 여기에 표시됩니다...';
        
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
                // 최종 결과 처리
                processTranscriptSafely(event.results[i][0].transcript, true);
            } else {
                // 임시 결과 처리
                interimTranscript += event.results[i][0].transcript;
            }
        }
        if (interimTranscript) {
            processTranscriptSafely(interimTranscript, false);
        }
    };

} else {
    startButton.disabled = true;
    transcriptTextarea.placeholder = '이 브라우저에서는 음성 인식을 지원하지 않습니다. Chrome 브라우저를 사용해보세요.';
    alert('이 브라우저에서는 음성 인식을 지원하지 않습니다. Chrome 브라우저를 사용해보세요.');
}

// 🔧 개선된 키 입력 이벤트 리스너
document.addEventListener('keydown', (event) => {
    if (!recognizing) return;

    if (event.key === '1' || event.key === '2') {
        // 화자 변경 요청 설정
        speakerChangeRequested = true;
        pendingSpeaker = event.key === '1' ? '의사' : '환자/보호자';
        
        // 현재 진행 중인 임시 결과가 있으면 먼저 처리
        if (pendingTranscript && !isProcessingTranscript) {
            processTranscriptSafely(pendingTranscript, true);
        }
        
        // 화자 변경 적용
        applySpeakerChange();
    }
});

// 🔧 새로운 화자 변경 적용 함수
function applySpeakerChange() {
    if (speakerChangeRequested && pendingSpeaker) {
        currentSpeaker = pendingSpeaker;
        
        // 새로운 화자 표시 추가 (중복 방지)
        const currentValue = transcriptTextarea.value;
        const speakerPrefix = currentSpeaker + ': ';
        
        // 이미 같은 화자 표시가 있는지 확인
        if (!currentValue.endsWith(speakerPrefix)) {
            if (!currentValue.endsWith('\n') && currentValue.length > 0) {
                transcriptTextarea.value += '\n';
            }
            transcriptTextarea.value += speakerPrefix;
        }
        
        // 상태 초기화
        speakerChangeRequested = false;
        pendingSpeaker = null;
        
        console.log(`화자 변경: ${currentSpeaker}`);
    }
}

startButton.addEventListener('click', async () => {
    if (recognizing) return;
    
    if (!apiKeyInput.value.trim()) {
        startButton.textContent = 'API 키 필요';
        startButton.style.backgroundColor = '#ffc107';
        startButton.style.color = '#212529';
        setTimeout(() => {
            startButton.textContent = '음성 인식 시작';
            startButton.style.backgroundColor = '';
            startButton.style.color = '';
        }, 2000);
        apiKeyInput.focus();
        return;
    }
    
    finalTranscript = transcriptTextarea.value;
    if (finalTranscript.length > 0 && !finalTranscript.endsWith('\n')) {
        finalTranscript += '\n';
    }
    
    // 🔧 모든 상태 초기화
    currentSpeaker = null;
    speakerChangeRequested = false;
    pendingSpeaker = null;
    isProcessingTranscript = false;
    transcriptQueue = [];
    lastProcessedText = '';
    restartRecognition = false;
    
    try {
        recognition.start();
    } catch (e) {
        console.error('음성 인식 시작 실패:', e);
        startButton.textContent = '시작 실패';
        startButton.style.backgroundColor = '#dc3545';
        setTimeout(() => {
            startButton.textContent = '음성 인식 시작';
            startButton.style.backgroundColor = '';
        }, 2000);
    }
});

stopButton.addEventListener('click', () => {
    if (!recognizing) return;
    restartRecognition = false; // 수동 중지시 자동 재시작 방지
    if (recognitionTimeout) {
        clearTimeout(recognitionTimeout);
    }
    recognition.stop();
    
    // 🔧 수동 중지 시에도 마이크 스트림 유지
    // cleanupMicrophoneStream(); // 제거: 스트림을 유지하여 다음 사용 시 권한 팝업 방지
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
    
    // 🔧 새로운 상태 변수들도 초기화
    currentSpeaker = null;
    speakerChangeRequested = false;
    pendingSpeaker = null;
    pendingTranscript = '';
    transcriptBuffer = [];
    transcriptQueue = [];
    lastProcessedText = '';
    
    // 진행 중인 타이머 정리
    if (processingTimeout) {
        clearTimeout(processingTimeout);
        processingTimeout = null;
    }
    
    // 🔧 시각적 피드백 추가
    showClearFeedback(clearButton, '내용 지우기');
});

// 🔧 복사 피드백 헬퍼 함수
function showCopyFeedback(button, originalText, success = true) {
    if (success) {
        button.textContent = '✓ 복사됨';
        button.classList.add('copy-success');
    } else {
        button.textContent = '복사 실패';
        button.classList.add('copy-error');
    }
    
    button.disabled = true;
    
    setTimeout(() => {
        button.textContent = originalText;
        button.classList.remove('copy-success', 'copy-error');
        button.disabled = false;
    }, 1500);
}

function showNoCopyContent(button, originalText) {
    button.textContent = '복사할 내용 없음';
    button.style.backgroundColor = '#ffc107';
    button.style.color = '#212529';
    button.disabled = true;
    
    setTimeout(() => {
        button.textContent = originalText;
        button.style.backgroundColor = '';
        button.style.color = '';
        button.disabled = false;
    }, 1500);
}

copyButton.addEventListener('click', () => {
    const textToCopy = transcriptTextarea.value;
    if (!textToCopy) {
        showNoCopyContent(copyButton, '내용 복사');
        return;
    }
    
    navigator.clipboard.writeText(textToCopy)
        .then(() => {
            showCopyFeedback(copyButton, '내용 복사', true);
        })
        .catch(err => {
            console.error('Failed to copy text: ', err);
            showCopyFeedback(copyButton, '내용 복사', false);
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

// 🔧 삭제 피드백 헬퍼 함수
function showClearFeedback(button, originalText) {
    button.textContent = '✓ 삭제됨';
    button.classList.add('copy-success'); // 초록색 사용
    button.disabled = true;
    
    setTimeout(() => {
        button.textContent = originalText;
        button.classList.remove('copy-success');
        button.disabled = false;
    }, 1500);
}

// --- Subjective Output Actions ---
clearSubjectiveButton.addEventListener('click', () => {
    subjectiveOutput.textContent = '요약 결과가 여기에 표시됩니다.';
    
    // 🔧 시각적 피드백 추가
    showClearFeedback(clearSubjectiveButton, 'S 내용 지우기');
});

copySubjectiveButton.addEventListener('click', () => {
    const textToCopy = subjectiveOutput.textContent;
    if (!textToCopy || textToCopy === '요약 결과가 여기에 표시됩니다.') {
        showNoCopyContent(copySubjectiveButton, 'S 내용 복사');
        return;
    }
    
    navigator.clipboard.writeText(textToCopy)
        .then(() => {
            showCopyFeedback(copySubjectiveButton, 'S 내용 복사', true);
        })
        .catch(err => {
            console.error('Failed to copy S text: ', err);
            showCopyFeedback(copySubjectiveButton, 'S 내용 복사', false);
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
    
    // 🔧 시각적 피드백 추가
    showClearFeedback(clearPlanButton, 'P 내용 지우기');
});

copyPlanButton.addEventListener('click', () => {
    const textToCopy = planOutput.textContent;
    if (!textToCopy || textToCopy === '요약 결과가 여기에 표시됩니다.') {
        showNoCopyContent(copyPlanButton, 'P 내용 복사');
        return;
    }
    
    navigator.clipboard.writeText(textToCopy)
        .then(() => {
            showCopyFeedback(copyPlanButton, 'P 내용 복사', true);
        })
        .catch(err => {
            console.error('Failed to copy P text: ', err);
            showCopyFeedback(copyPlanButton, 'P 내용 복사', false);
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
    
    // 🔧 새로운 상태 변수들도 초기화
    currentSpeaker = null;
    speakerChangeRequested = false;
    pendingSpeaker = null;
    pendingTranscript = '';
    transcriptBuffer = [];
    transcriptQueue = [];
    lastProcessedText = '';
    
    // 진행 중인 타이머 정리
    if (processingTimeout) {
        clearTimeout(processingTimeout);
        processingTimeout = null;
    }

    // 🔧 팝업 대신 버튼 피드백으로 변경
    showClearFeedback(clearAllButton, '전체 내용 지우기');
});

// Enable summarize button if there's text on load
if (transcriptTextarea.value.trim() !== '') {
    summarizeButton.disabled = false;
}

// 🔧 개선된 음성 인식 결과 처리 함수
function processTranscriptSafely(text, isFinal) {
    // 중복 처리 방지
    if (isProcessingTranscript) {
        transcriptQueue.push({ text, isFinal });
        return;
    }
    
    // 같은 텍스트 중복 처리 방지
    if (text === lastProcessedText && isFinal) {
        return;
    }
    
    isProcessingTranscript = true;
    
    try {
        if (isFinal) {
            // 최종 결과 처리
            lastProcessedText = text;
            
            // 화자가 설정되지 않은 경우 기본값 설정
            if (!currentSpeaker) {
                currentSpeaker = '환자/보호자';
                console.log('화자가 설정되지 않아 기본값(환자/보호자)으로 설정');
            }
            
            // 텍스트가 비어있지 않은 경우에만 처리
            if (text.trim()) {
                const transcript = currentSpeaker + ': ' + text.trim();
                addToTranscriptBuffer(transcript);
            }
            
            pendingTranscript = '';
        } else {
            // 임시 결과 처리
            pendingTranscript = text;
            updateDisplaySafely();
        }
    } finally {
        isProcessingTranscript = false;
        
        // 큐에 대기 중인 작업 처리
        processTranscriptQueue();
    }
}

// 🔧 큐 처리 함수
function processTranscriptQueue() {
    if (transcriptQueue.length > 0 && !isProcessingTranscript) {
        const nextItem = transcriptQueue.shift();
        processTranscriptSafely(nextItem.text, nextItem.isFinal);
    }
}

// 🔧 개선된 버퍼 추가 함수
function addToTranscriptBuffer(transcript) {
    transcriptBuffer.push(transcript);
    processBufferSafely();
}

// 🔧 개선된 버퍼 처리 함수
function processBufferSafely() {
    // 기존 타이머가 있으면 취소하지 않고 연장
    if (processingTimeout) {
        clearTimeout(processingTimeout);
    }

    processingTimeout = setTimeout(() => {
        if (transcriptBuffer.length > 0) {
            // 버퍼의 모든 내용을 한 번에 처리
            const newText = transcriptBuffer.join('\n') + '\n';
            finalTranscript += newText;
            transcriptBuffer = [];
            updateDisplaySafely();
            
            console.log('버퍼 처리 완료:', transcriptBuffer.length, '개 항목');
        }
        processingTimeout = null;
    }, 200); // 200ms로 증가하여 안정성 향상
}

// 🔧 안전한 화면 업데이트 함수
function updateDisplaySafely() {
    try {
        // 현재 커서 위치 저장
        const cursorPosition = transcriptTextarea.selectionStart;
        
        // 화면 업데이트
        const displayText = finalTranscript + 
            (currentSpeaker && pendingTranscript ? currentSpeaker + ': ' + pendingTranscript : 
             pendingTranscript ? pendingTranscript : '');
        
        // 내용이 실제로 변경된 경우에만 업데이트
        if (transcriptTextarea.value !== displayText) {
            transcriptTextarea.value = displayText;
            
            // 커서 위치 복원 (가능한 경우)
            if (cursorPosition <= displayText.length) {
                transcriptTextarea.setSelectionRange(cursorPosition, cursorPosition);
            }
        }
        
        // 요약 버튼 상태 업데이트
        summarizeButton.disabled = transcriptTextarea.value.trim() === '';
        
        // 스크롤을 맨 아래로
        transcriptTextarea.scrollTop = transcriptTextarea.scrollHeight;
        
    } catch (error) {
        console.error('화면 업데이트 오류:', error);
    }
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

// 🔧 마이크 권한 확인 및 요청 함수
async function checkMicrophonePermission() {
    try {
        if (navigator.permissions) {
            const permission = await navigator.permissions.query({ name: 'microphone' });
            microphonePermission = permission.state;
            
            // 권한 상태 변경 감지
            permission.onchange = () => {
                microphonePermission = permission.state;
                updatePermissionStatus();
            };
            
            updatePermissionStatus();
            return permission.state;
        }
    } catch (error) {
        console.log('권한 API를 사용할 수 없습니다:', error);
    }
    return 'unknown';
}

// 🔧 권한 상태 업데이트 함수
function updatePermissionStatus() {
    const statusElement = document.getElementById('permissionStatus');
    const requestButton = document.getElementById('requestPermissionButton');
    if (!statusElement) return;
    
    switch (microphonePermission) {
        case 'granted':
            statusElement.innerHTML = '🎤 <span style="color: #28a745;">마이크 권한 허용됨 - 음성인식 사용 가능</span>';
            statusElement.className = 'permission-status granted';
            if (requestButton) requestButton.style.display = 'none';
            break;
        case 'denied':
            statusElement.innerHTML = '🚫 <span style="color: #dc3545;">마이크 권한 거부됨 - 브라우저 설정에서 허용해주세요</span>';
            statusElement.className = 'permission-status denied';
            if (requestButton) requestButton.style.display = 'inline-block';
            break;
        case 'prompt':
            statusElement.innerHTML = '⚠️ <span style="color: #ffc107;">마이크 권한이 필요합니다 - 아래 버튼을 클릭해주세요</span>';
            statusElement.className = 'permission-status prompt';
            if (requestButton) requestButton.style.display = 'inline-block';
            break;
        default:
            statusElement.innerHTML = '❓ <span style="color: #6c757d;">마이크 권한 상태 확인 중...</span>';
            statusElement.className = 'permission-status unknown';
            if (requestButton) requestButton.style.display = 'inline-block';
    }
}

// 🔧 마이크 권한 사전 요청 함수 (개선)
async function requestMicrophonePermission() {
    if (isPermissionRequesting) return false;
    
    isPermissionRequesting = true;
    const requestButton = document.getElementById('requestPermissionButton');
    
    try {
        if (requestButton) {
            requestButton.textContent = '권한 요청 중...';
            requestButton.disabled = true;
        }
        
        // 기존 스트림이 있으면 정리
        if (microphoneStream) {
            microphoneStream.getTracks().forEach(track => track.stop());
            microphoneStream = null;
        }
        
        // 마이크 스트림 요청
        microphoneStream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });
        
        microphonePermission = 'granted';
        updatePermissionStatus();
        
        // 🔧 스트림을 바로 종료하지 않고 유지 (권한 유지를 위해)
        console.log('마이크 권한 획득 성공');
        
        if (requestButton) {
            requestButton.textContent = '✓ 권한 허용됨';
            requestButton.style.backgroundColor = '#28a745';
            setTimeout(() => {
                requestButton.style.display = 'none';
            }, 1500);
        }
        
        return true;
    } catch (error) {
        console.error('마이크 권한 요청 실패:', error);
        microphonePermission = 'denied';
        updatePermissionStatus();
        
        if (requestButton) {
            requestButton.textContent = '권한 거부됨';
            requestButton.style.backgroundColor = '#dc3545';
            setTimeout(() => {
                requestButton.textContent = '🎤 마이크 권한 허용하기';
                requestButton.style.backgroundColor = '';
                requestButton.disabled = false;
            }, 2000);
        }
        
        return false;
    } finally {
        isPermissionRequesting = false;
    }
}

// 🔧 마이크 스트림 정리 함수
function cleanupMicrophoneStream() {
    if (microphoneStream) {
        microphoneStream.getTracks().forEach(track => track.stop());
        microphoneStream = null;
    }
}

// 🔧 페이지 언로드 시 스트림 정리
window.addEventListener('beforeunload', () => {
    cleanupMicrophoneStream();
}); 