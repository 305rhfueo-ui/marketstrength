// 전역 설정: Chart.js 다크 테마 텍스트 색상
Chart.defaults.color = '#94a3b8';
Chart.defaults.font.family = "'Inter', sans-serif";

let data = null;
let current = null;
let indicators = [];

const loadData = async () => {
    try {
        // GitHub Pages 환경에서는 캐시 방지를 위해 쿼리 파라미터를 붙이는 것이 좋습니다.
        const response = await fetch('data.json?t=' + new Date().getTime());
        data = await response.json();
        
        current = {
            qqq: data.qqq[data.qqq.length - 1],
            qqq50ma: data.qqq50ma[data.qqq50ma.length - 1],
            above200ma: data.above200ma[data.above200ma.length - 1],
            highLow: data.highLow[data.highLow.length - 1],
            vix: data.vix[data.vix.length - 1],
            fearGreed: data.fearGreed[data.fearGreed.length - 1]
        };
        
        indicators = evaluateIndicators();
        evaluateOverall();
        renderMainChart();
        renderIndicatorsList();
        
    } catch (error) {
        console.error("데이터 로드 실패:", error);
        document.getElementById('overall-signal').innerText = "에러";
        document.getElementById('overall-desc').innerText = "데이터를 불러오는 중 문제가 발생했습니다.";
    }
};

// 1. 지표 평가 로직
const evaluateIndicators = () => {
    const results = [];
    
    // 1) QQQ vs 50일선
    const qqqDiff = (current.qqq - current.qqq50ma) / current.qqq50ma * 100;
    let ind1 = { 
        name: "QQQ vs 50일선", 
        value: `${current.qqq.toFixed(2)} / 50MA: ${current.qqq50ma.toFixed(2)}`, 
        status: 'yellow', 
        text: '닿아있음',
        description: `<strong>기관이 가장 많이 보는 중기 추세선입니다.</strong> 
        <ul>
            <li>깨지면 기관 방어 매수가 사라질 확률이 높습니다.</li>
            <li>단점: 단일 지표라 변동성 장에서 늦거나 틀릴 수 있어 다른 지표들과 함께 보아야 합니다.</li>
        </ul>`
    };
    if (qqqDiff > 1) { ind1.status = 'green'; ind1.text = '위 (강세)'; }
    else if (qqqDiff < -1) { ind1.status = 'red'; ind1.text = '아래 (위험)'; }
    results.push({ ...ind1, key: 'qqqVs50ma', dataKey: ['qqq', 'qqq50ma'], type: 'line' });

    // 2) % Above 200MA
    let ind2 = { 
        name: "% Above 200MA (나스닥)", 
        value: `${current.above200ma.toFixed(1)}%`, 
        status: 'yellow', 
        text: '40~60%',
        description: `<strong>가장 객관적인 강세장 척도입니다. (나스닥 종목 중 200일선 위에 있는 비율)</strong>
        <ul>
            <li>70% 이상 = 강한 강세 / 30% 이하 = 약세장 / 20% 이하 = 바닥 신호</li>
            <li>지수는 빅테크 7개가 끌어올려도, 이 전체 비율은 시장의 진짜 온도를 거짓말하지 못합니다.</li>
        </ul>`
    };
    if (current.above200ma > 60) { ind2.status = 'green'; ind2.text = '>60%'; }
    else if (current.above200ma < 40) { ind2.status = 'red'; ind2.text = '<40%'; }
    results.push({ ...ind2, key: 'above200ma', dataKey: ['above200ma'], type: 'line' });

    // 3) 신고가-신저가
    let ind3 = { 
        name: "신고가-신저가 (NASDAQ)", 
        value: `${current.highLow > 0 ? '+' : ''}${current.highLow.toFixed(0)}`, 
        status: 'yellow', 
        text: '비슷',
        description: `<strong>돌파 매매와 직접 연동되는 지표입니다.</strong>
        <ul>
            <li>강세장의 본질은 "오르는 종목이 많아지는 것"입니다.</li>
            <li>신고가가 폭발하는 시기가 곧 돌파 매매의 성공률이 최고조에 달하는 때입니다.</li>
            <li>신고가 < 신저가가 되면 설령 지수가 50일선 위라도 강제 관망해야 합니다.</li>
        </ul>`
    };
    if (current.highLow > 100) { ind3.status = 'green'; ind3.text = '신고가 >> 신저가'; }
    else if (current.highLow < -100) { ind3.status = 'red'; ind3.text = '신저가 > 신고가'; }
    results.push({ ...ind3, key: 'highLow', dataKey: ['highLow'], type: 'bar' });

    // 4) VIX
    let ind4 = { 
        name: "VIX", 
        value: current.vix.toFixed(2), 
        status: 'yellow', 
        text: '18~25',
        description: `<strong>시장의 공포(변동성) 지수입니다.</strong>
        <ul>
            <li>12 이하 = 안일함 (천장 신호 가능성)</li>
            <li>18~25 = 불안 장세</li>
            <li>25 이상 = 강세 전략 즉시 중단</li>
            <li>"변동성이 커졌다"는 느낌이 정량적으로 확인되는 핵심 지표입니다.</li>
        </ul>`
    };
    if (current.vix < 18) { ind4.status = 'green'; ind4.text = '<18'; }
    else if (current.vix > 25) { ind4.status = 'red'; ind4.text = '>25'; }
    results.push({ ...ind4, key: 'vix', dataKey: ['vix'], type: 'line' });

    // 5) Fear & Greed
    let ind5 = { 
        name: "Fear & Greed Index", 
        value: current.fearGreed.toFixed(0), 
        status: 'yellow', 
        text: '25~50, 75~85',
        description: `<strong>CNN이 7개 지표를 합성해 만든 0~100 점수의 시장 심리 지수입니다.</strong>
        <ul>
            <li>극단적인 공포(Extreme Fear) 구간에 진입할 때가 종종 좋은 재진입/매수 타이밍이 됩니다.</li>
            <li>시장 참여자들의 감정적 과열이나 투매를 객관적으로 보여줍니다.</li>
        </ul>`
    };
    if (current.fearGreed >= 50 && current.fearGreed <= 75) { ind5.status = 'green'; ind5.text = '50~75'; }
    else if (current.fearGreed < 25 || current.fearGreed > 85) { ind5.status = 'red'; ind5.text = '<25, >85'; }
    results.push({ ...ind5, key: 'fearGreed', dataKey: ['fearGreed'], type: 'line' });

    return results;
};

// 2. 종합 판정 로직
const evaluateOverall = () => {
    let green = 0, yellow = 0, red = 0;
    indicators.forEach(i => {
        if (i.status === 'green') green++;
        else if (i.status === 'yellow') yellow++;
        else red++;
    });

    // 화면 업데이트
    document.getElementById('count-green').innerText = green;
    document.getElementById('count-yellow').innerText = yellow;
    document.getElementById('count-red').innerText = red;

    const signalEl = document.getElementById('overall-signal');
    const descEl = document.getElementById('overall-desc');

    if (red >= 2) {
        signalEl.className = 'signal-badge red';
        signalEl.innerText = '강제 관망';
        descEl.innerText = '위험 신호 2개 이상. 보유 종목 청산 규칙만 작동합니다.';
    } else if (green >= 4) {
        signalEl.className = 'signal-badge green';
        signalEl.innerText = '적극 매매';
        descEl.innerText = '정상 비중 100%. 매우 양호한 강세장입니다.';
    } else if (green === 3) {
        signalEl.className = 'signal-badge green';
        signalEl.innerText = '보통 매매';
        descEl.innerText = '비중 70%. 무난한 장세입니다.';
    } else {
        signalEl.className = 'signal-badge yellow';
        signalEl.innerText = '보수적';
        descEl.innerText = '비중 50%. 신규 진입을 최소화하세요.';
    }
};

// 3. 메인 차트 렌더링 (QQQ vs 50MA)
const renderMainChart = () => {
    const ctx = document.getElementById('mainChart').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.dates,
            datasets: [
                {
                    label: 'QQQ Price',
                    data: data.qqq,
                    borderColor: '#f8fafc',
                    borderWidth: 2,
                    tension: 0.1,
                    pointRadius: 0,
                    pointHitRadius: 10
                },
                {
                    label: '50-Day MA',
                    data: data.qqq50ma,
                    borderColor: '#10b981', // green
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.1,
                    pointRadius: 0,
                    pointHitRadius: 10
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: { position: 'top' },
                tooltip: { backgroundColor: 'rgba(15, 23, 42, 0.9)' }
            },
            scales: {
                x: {
                    grid: { display: false, drawBorder: false },
                    ticks: { maxTicksLimit: 6 }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' }
                }
            }
        }
    });
};

// 4. 지표 리스트 렌더링
let detailChartInstance = null;

const renderDetailChart = (indicator) => {
    document.getElementById('detail-chart-title').innerText = `${indicator.name} (최근 1년)`;
    document.getElementById('detail-desc').innerHTML = indicator.description || '선택한 지표의 상세 설명이 여기에 표시됩니다.';
    
    const ctx = document.getElementById('detailChart').getContext('2d');
    
    if (detailChartInstance) {
        detailChartInstance.destroy();
    }

    const datasets = indicator.dataKey.map((key, idx) => {
        return {
            label: key.toUpperCase(),
            data: data[key],
            borderColor: idx === 0 ? '#60a5fa' : '#a78bfa',
            backgroundColor: indicator.type === 'bar' ? (ctx => {
                const value = ctx.raw;
                return value > 0 ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.5)';
            }) : 'transparent',
            borderWidth: 2,
            tension: 0.1,
            pointRadius: 0
        };
    });

    detailChartInstance = new Chart(ctx, {
        type: indicator.type,
        data: {
            labels: data.dates,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: { legend: { display: indicator.dataKey.length > 1 } },
            scales: {
                x: { grid: { display: false }, ticks: { maxTicksLimit: 6 } },
                y: { grid: { color: 'rgba(255, 255, 255, 0.05)' } }
            }
        }
    });
};

const renderIndicatorsList = () => {
    const container = document.getElementById('indicators-container');
    container.innerHTML = '';

    indicators.forEach((ind, index) => {
        const div = document.createElement('div');
        div.className = 'indicator-item';
        if (index === 0) div.classList.add('active'); // Default active
        
        div.innerHTML = `
            <div class="ind-name">
                ${ind.name} 
                <span class="guide-link" title="${ind.name} 해석 가이드 보기">❓ 가이드</span>
            </div>
            <div class="ind-value">${ind.value}</div>
            <div class="ind-status ${ind.status}">${ind.text}</div>
        `;
        
        // 차트 표시 이벤트
        div.addEventListener('click', (e) => {
            // 만약 가이드 링크를 클릭한 것이라면 차트 전환 무시
            if (e.target.classList.contains('guide-link')) return;

            document.querySelectorAll('.indicator-item').forEach(el => el.classList.remove('active'));
            div.classList.add('active');
            renderDetailChart(ind);
        });

        // 가이드 링크 모달 띄우기 이벤트
        const guideLink = div.querySelector('.guide-link');
        guideLink.addEventListener('click', (e) => {
            e.stopPropagation(); // 부모(차트전환)로의 이벤트 전파 방지
            const modal = document.getElementById('guideModal');
            document.getElementById('modal-title').innerText = `${ind.name} 해석 가이드`;
            document.getElementById('modal-desc').innerHTML = ind.description;
            modal.style.display = 'block';
        });
        
        container.appendChild(div);
    });

    // 기본으로 첫 번째 차트 렌더링
    renderDetailChart(indicators[0]);
};

// 초기화
window.addEventListener('DOMContentLoaded', () => {
    loadData();

    // 모달 닫기 이벤트 처리
    const modal = document.getElementById('guideModal');
    const closeBtn = document.querySelector('.close-btn');

    // 전체 설명서 팝업
    const fullGuideBtn = document.getElementById('full-guide-btn');
    if (fullGuideBtn) {
        fullGuideBtn.addEventListener('click', () => {
            document.getElementById('modal-title').innerText = "시장 환경 종합 진단 가이드 (원본 캡처 내용)";
            document.getElementById('modal-desc').innerHTML = `
                <div style="font-size: 0.95rem; line-height: 1.6;">
                    <h3 style="color: #fff; margin-bottom: 0.5rem; padding-bottom: 0.3rem; border-bottom: 1px solid rgba(255,255,255,0.1);">종합 판정 규칙</h3>
                    <ul style="margin-left: 1rem; margin-bottom: 1.5rem;">
                        <li>🟢 <strong>4개 이상</strong> &rarr; 적극 매매 (정상 비중 100%)</li>
                        <li>🟢 <strong>3개</strong> &rarr; 보통 매매 (비중 70%)</li>
                        <li>🟢 <strong>2개 이하</strong> &rarr; 보수적 (비중 50%, 신규 진입 최소화)</li>
                        <li>🔴 <strong>2개 이상</strong> &rarr; 강제 관망, 보유 종목은 청산 규칙만 작동</li>
                    </ul>
                    <h3 style="color: #fff; margin-bottom: 0.5rem; padding-bottom: 0.3rem; border-bottom: 1px solid rgba(255,255,255,0.1);">각 지표 설명</h3>
                    <h4 style="color: #60a5fa; margin-top: 1rem;">① QQQ vs 50일선</h4>
                    <ul style="margin-left: 1rem; margin-bottom: 1rem;">
                        <li>기관이 가장 많이 보는 중기 추세선. 깨지면 기관 방어 매수 사라짐</li>
                        <li>단점: 단일 지표라 변동성 장에서 늦거나 틀릴 수 있음 &rarr; 그래서 4개 더 본다</li>
                    </ul>
                    <h4 style="color: #60a5fa; margin-top: 1rem;">② % Above 200MA (가장 객관적인 강세장 척도)</h4>
                    <ul style="margin-left: 1rem; margin-bottom: 1rem;">
                        <li>나스닥 종목 중 200일선 위에 있는 비율</li>
                        <li>70% 이상 = 강한 강세 / 30% 이하 = 약세장 / 20% 이하 = 바닥 신호</li>
                        <li>지수는 빅테크 7개가 끌어올려도, 이 비율은 거짓말 못 함</li>
                    </ul>
                    <h4 style="color: #60a5fa; margin-top: 1rem;">③ 신고가-신저가 비율 (돌파 매매와 직접 연동)</h4>
                    <ul style="margin-left: 1rem; margin-bottom: 1rem;">
                        <li>강세장의 본질은 "오르는 종목이 많아지는 것"</li>
                        <li>신고가가 폭발하는 시기 = 돌파 매매 성공률 최고</li>
                        <li>신고가 &lt; 신저가가 되면 50일선 위라도 강제 관망</li>
                    </ul>
                    <h4 style="color: #60a5fa; margin-top: 1rem;">④ VIX (공포 지수)</h4>
                    <ul style="margin-left: 1rem; margin-bottom: 1rem;">
                        <li>12 이하 = 안일함(천장 신호) / 18~25 = 불안 / 25 이상 = 강세 전략 중단</li>
                        <li>6월처럼 "변동성이 커졌다"가 정량적으로 확인되는 지표</li>
                    </ul>
                    <h4 style="color: #60a5fa; margin-top: 1rem;">⑤ Fear & Greed Index</h4>
                    <ul style="margin-left: 1rem; margin-bottom: 1rem;">
                        <li>CNN이 7개 지표를 합성한 0~100 점수</li>
                        <li>응봉아재 가이드의 "Fear까지 갈 때 재진입"이 정확히 이것</li>
                    </ul>
                </div>
            `;
            modal.style.display = 'block';
        });
    }

    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    window.addEventListener('click', (e) => {
        if (e.target == modal) {
            modal.style.display = 'none';
        }
    });
});
