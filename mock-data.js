// 가상의 1년(약 252 거래일)치 시장 데이터를 생성합니다.
const generateMockData = () => {
    const dates = [];
    const qqq = [];
    const qqq50ma = [];
    const above200ma = [];
    const highLow = [];
    const vix = [];
    const fearGreed = [];

    let currentQqq = 380;
    let currentVix = 20;
    let currentFg = 50;
    
    // 1년 전 날짜부터 오늘까지 생성
    const today = new Date();
    for (let i = 252; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        dates.push(d.toISOString().split('T')[0]);

        // 간단한 랜덤 워크로 데이터 생성
        currentQqq += (Math.random() - 0.45) * 5; // 우상향 경향
        qqq.push(currentQqq);

        // VIX는 시장과 반대로 움직이는 경향
        currentVix += (Math.random() - 0.5) * 2;
        currentVix = Math.max(10, Math.min(80, currentVix));
        vix.push(currentVix);

        // F&G
        currentFg += (Math.random() - 0.5) * 5;
        currentFg = Math.max(0, Math.min(100, currentFg));
        fearGreed.push(currentFg);

        // Above 200MA (0~100)
        above200ma.push(Math.max(0, Math.min(100, currentFg * 0.8 + Math.random() * 20)));

        // 신고가-신저가
        highLow.push((currentFg - 50) * 10 + Math.random() * 100);
    }

    // 50일 이동평균선 계산
    for (let i = 0; i < qqq.length; i++) {
        if (i < 50) {
            qqq50ma.push(qqq[i]); // 초기값은 현재가로
        } else {
            const sum = qqq.slice(i - 50, i).reduce((a, b) => a + b, 0);
            qqq50ma.push(sum / 50);
        }
    }

    return {
        dates,
        qqq,
        qqq50ma,
        above200ma,
        highLow,
        vix,
        fearGreed
    };
};

const marketData = generateMockData();

// 현재(최신) 지표 값 추출
const currentIndicators = {
    qqq: marketData.qqq[marketData.qqq.length - 1],
    qqq50ma: marketData.qqq50ma[marketData.qqq50ma.length - 1],
    above200ma: marketData.above200ma[marketData.above200ma.length - 1],
    highLow: marketData.highLow[marketData.highLow.length - 1],
    vix: marketData.vix[marketData.vix.length - 1],
    fearGreed: marketData.fearGreed[marketData.fearGreed.length - 1]
};

// 모듈로 내보내기 (브라우저 환경)
window.mockData = marketData;
window.currentIndicators = currentIndicators;
