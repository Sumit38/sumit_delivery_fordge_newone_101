import { NextRequest, NextResponse } from "next/server";
import PptxGenJS from "pptxgenjs";

// Executive Theme Colors
const EXECUTIVE_COLORS = {
  darkNavy: "1A365D",      // Primary dark navy
  gold: "D4AF37",          // Gold accent
  lightGray: "F7FAFC",     // Light background
  darkText: "1A365D",      // Text color
  white: "FFFFFF",         // White
  lightBlue: "EBF4FF",     // Light blue accent
};

// TITLE SLIDE - Full screen impact with gold accents
function addTitleSlide(prs: any, slide: any, totalSlides: number) {
  const slideObj = prs.addSlide();

  // Dark navy background
  slideObj.background = { color: EXECUTIVE_COLORS.darkNavy };

  // Gold accent bar at top
  slideObj.addShape(prs.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 10,
    h: 0.15,
    fill: { color: EXECUTIVE_COLORS.gold },
    line: { type: "none" },
  });

  // Main title
  slideObj.addText(slide.title, {
    x: 0.5,
    y: 2.5,
    w: 9,
    h: 1.2,
    fontSize: 54,
    bold: true,
    color: EXECUTIVE_COLORS.gold,
    align: "center",
    fontFace: "Calibri",
  });

  // Tagline or subtitle
  if (slide.tagline) {
    slideObj.addText(slide.tagline, {
      x: 0.5,
      y: 3.9,
      w: 9,
      h: 0.6,
      fontSize: 28,
      color: EXECUTIVE_COLORS.white,
      align: "center",
      fontFace: "Calibri",
    });
  }

  // Description
  if (slide.description) {
    slideObj.addText(slide.description, {
      x: 1,
      y: 5.2,
      w: 8,
      h: 1.2,
      fontSize: 16,
      color: EXECUTIVE_COLORS.lightGray,
      align: "center",
      fontFace: "Calibri",
    });
  }

  // Gold accent line at bottom
  slideObj.addShape(prs.ShapeType.rect, {
    x: 2,
    y: 6.7,
    w: 6,
    h: 0.08,
    fill: { color: EXECUTIVE_COLORS.gold },
    line: { type: "none" },
  });
}

// CONTENT SLIDE - Navy header with white content area
function addContentSlide(prs: any, slide: any, totalSlides: number) {
  const slideObj = prs.addSlide();

  // Light background
  slideObj.background = { color: EXECUTIVE_COLORS.lightGray };

  // Navy header bar
  slideObj.addShape(prs.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 10,
    h: 1,
    fill: { color: EXECUTIVE_COLORS.darkNavy },
    line: { type: "none" },
  });

  // Gold accent bar
  slideObj.addShape(prs.ShapeType.rect, {
    x: 0,
    y: 0.95,
    w: 10,
    h: 0.08,
    fill: { color: EXECUTIVE_COLORS.gold },
    line: { type: "none" },
  });

  // Slide title
  slideObj.addText(slide.title, {
    x: 0.5,
    y: 0.25,
    w: 8.5,
    h: 0.6,
    fontSize: 36,
    bold: true,
    color: EXECUTIVE_COLORS.gold,
    fontFace: "Calibri",
    align: "left",
  });

  // Description paragraph
  if (slide.description) {
    slideObj.addText(slide.description, {
      x: 0.7,
      y: 1.3,
      w: 8.6,
      h: 0.8,
      fontSize: 14,
      color: EXECUTIVE_COLORS.darkText,
      fontFace: "Calibri",
      align: "left",
    });
  }

  // Content bullets with gold dots
  let yPosition = 2.3;
  slide.content.forEach((point: string) => {
    // Gold bullet dot
    slideObj.addShape(prs.ShapeType.ellipse, {
      x: 0.7,
      y: yPosition + 0.15,
      w: 0.15,
      h: 0.15,
      fill: { color: EXECUTIVE_COLORS.gold },
      line: { type: "none" },
    });

    // Bullet text
    slideObj.addText(point, {
      x: 1.1,
      y: yPosition,
      w: 8.2,
      h: 0.5,
      fontSize: 16,
      color: EXECUTIVE_COLORS.darkText,
      fontFace: "Calibri",
      align: "left",
    });
    yPosition += 0.75;
  });

  // Add footer
  const addFooter = (slideObj: any, slideNumber: number, totalSlides: number) => {
    slideObj.addShape(prs.ShapeType.rect, {
      x: 0,
      y: 6.9,
      w: 10,
      h: 0.05,
      fill: { color: EXECUTIVE_COLORS.gold },
      line: { type: "none" },
    });
    slideObj.addText(`© DeliveryForge`, {
      x: 0.5,
      y: 7.0,
      w: 4,
      h: 0.35,
      fontSize: 8,
      color: EXECUTIVE_COLORS.darkText,
      fontFace: "Calibri",
      align: "left",
    });
    slideObj.addText(`Slide ${slideNumber} of ${totalSlides}`, {
      x: 5.5,
      y: 7.0,
      w: 4,
      h: 0.35,
      fontSize: 8,
      color: EXECUTIVE_COLORS.darkNavy,
      fontFace: "Calibri",
      align: "right",
    });
  };

  addFooter(slideObj, slide.slideNumber, totalSlides);
}

// ROADMAP SLIDE - Visual timeline with phases
function addRoadmapSlide(prs: any, slide: any, totalSlides: number) {
  const slideObj = prs.addSlide();

  slideObj.background = { color: EXECUTIVE_COLORS.white };

  // Navy header bar
  slideObj.addShape(prs.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 10,
    h: 1,
    fill: { color: EXECUTIVE_COLORS.darkNavy },
    line: { type: "none" },
  });

  // Gold accent bar
  slideObj.addShape(prs.ShapeType.rect, {
    x: 0,
    y: 0.95,
    w: 10,
    h: 0.08,
    fill: { color: EXECUTIVE_COLORS.gold },
    line: { type: "none" },
  });

  // Slide title
  slideObj.addText(slide.title, {
    x: 0.5,
    y: 0.25,
    w: 8.5,
    h: 0.6,
    fontSize: 36,
    bold: true,
    color: EXECUTIVE_COLORS.gold,
    fontFace: "Calibri",
    align: "left",
  });

  // Timeline visualization
  const phases = slide.specialData?.phases || [];
  const timelineStartY = 1.8;
  const phaseWidth = 8.5 / Math.max(phases.length, 1);
  const phaseStartX = 0.75;

  // Draw timeline connector line
  slideObj.addShape(prs.ShapeType.line, {
    x: phaseStartX,
    y: timelineStartY + 0.5,
    w: 8.5,
    h: 0,
    line: { color: EXECUTIVE_COLORS.gold, width: 3 },
  });

  // Draw phases
  phases.forEach((phase: any, index: number) => {
    const phaseX = phaseStartX + (index * phaseWidth);

    // Phase circle
    slideObj.addShape(prs.ShapeType.ellipse, {
      x: phaseX + phaseWidth / 2 - 0.25,
      y: timelineStartY + 0.25,
      w: 0.5,
      h: 0.5,
      fill: { color: EXECUTIVE_COLORS.darkNavy },
      line: { color: EXECUTIVE_COLORS.gold, width: 2 },
    });

    // Phase number
    slideObj.addText((index + 1).toString(), {
      x: phaseX + phaseWidth / 2 - 0.2,
      y: timelineStartY + 0.27,
      w: 0.4,
      h: 0.4,
      fontSize: 20,
      bold: true,
      color: EXECUTIVE_COLORS.gold,
      fontFace: "Calibri",
      align: "center",
    });

    // Phase name
    slideObj.addText(phase.name, {
      x: phaseX,
      y: timelineStartY + 0.95,
      w: phaseWidth,
      h: 0.4,
      fontSize: 12,
      bold: true,
      color: EXECUTIVE_COLORS.darkNavy,
      fontFace: "Calibri",
      align: "center",
    });

    // Duration
    slideObj.addText(phase.duration, {
      x: phaseX,
      y: timelineStartY + 1.35,
      w: phaseWidth,
      h: 0.3,
      fontSize: 11,
      color: EXECUTIVE_COLORS.gold,
      fontFace: "Calibri",
      align: "center",
    });

    // Description
    slideObj.addText(phase.description, {
      x: phaseX - 0.2,
      y: timelineStartY + 1.7,
      w: phaseWidth + 0.4,
      h: 0.6,
      fontSize: 9,
      color: EXECUTIVE_COLORS.darkText,
      fontFace: "Calibri",
      align: "center",
    });
  });

  // Add footer
  const addFooter = (slideObj: any, slideNumber: number, totalSlides: number) => {
    slideObj.addShape(prs.ShapeType.rect, {
      x: 0,
      y: 6.9,
      w: 10,
      h: 0.05,
      fill: { color: EXECUTIVE_COLORS.gold },
      line: { type: "none" },
    });
    slideObj.addText(`© DeliveryForge`, {
      x: 0.5,
      y: 7.0,
      w: 4,
      h: 0.35,
      fontSize: 8,
      color: EXECUTIVE_COLORS.darkText,
      fontFace: "Calibri",
      align: "left",
    });
    slideObj.addText(`Slide ${slideNumber} of ${totalSlides}`, {
      x: 5.5,
      y: 7.0,
      w: 4,
      h: 0.35,
      fontSize: 8,
      color: EXECUTIVE_COLORS.darkNavy,
      fontFace: "Calibri",
      align: "right",
    });
  };

  addFooter(slideObj, slide.slideNumber, totalSlides);
}

// METRICS SLIDE - Data cards layout
function addMetricsSlide(prs: any, slide: any, totalSlides: number) {
  const slideObj = prs.addSlide();

  slideObj.background = { color: EXECUTIVE_COLORS.lightGray };

  // Navy header bar
  slideObj.addShape(prs.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 10,
    h: 1,
    fill: { color: EXECUTIVE_COLORS.darkNavy },
    line: { type: "none" },
  });

  // Gold accent bar
  slideObj.addShape(prs.ShapeType.rect, {
    x: 0,
    y: 0.95,
    w: 10,
    h: 0.08,
    fill: { color: EXECUTIVE_COLORS.gold },
    line: { type: "none" },
  });

  // Slide title
  slideObj.addText(slide.title, {
    x: 0.5,
    y: 0.25,
    w: 8.5,
    h: 0.6,
    fontSize: 36,
    bold: true,
    color: EXECUTIVE_COLORS.gold,
    fontFace: "Calibri",
    align: "left",
  });

  // Content as metric cards
  const cardWidth = 4;
  const cardHeight = 1.2;
  let cardX = 0.5;
  let cardY = 1.8;
  let cardCount = 0;

  slide.content.forEach((metric: string) => {
    if (cardCount > 0 && cardCount % 2 === 0) {
      cardX = 0.5;
      cardY += 1.6;
    } else if (cardCount > 0) {
      cardX = 5.2;
    }

    // Card background (navy)
    slideObj.addShape(prs.ShapeType.rect, {
      x: cardX,
      y: cardY,
      w: cardWidth,
      h: cardHeight,
      fill: { color: EXECUTIVE_COLORS.darkNavy },
      line: { color: EXECUTIVE_COLORS.gold, width: 2 },
    });

    // Card text
    slideObj.addText(metric, {
      x: cardX + 0.2,
      y: cardY + 0.15,
      w: cardWidth - 0.4,
      h: cardHeight - 0.3,
      fontSize: 14,
      bold: true,
      color: EXECUTIVE_COLORS.gold,
      fontFace: "Calibri",
      align: "center",
      valign: "middle",
    });

    cardCount++;
  });

  // Add footer
  const addFooter = (slideObj: any, slideNumber: number, totalSlides: number) => {
    slideObj.addShape(prs.ShapeType.rect, {
      x: 0,
      y: 6.9,
      w: 10,
      h: 0.05,
      fill: { color: EXECUTIVE_COLORS.gold },
      line: { type: "none" },
    });
    slideObj.addText(`© DeliveryForge`, {
      x: 0.5,
      y: 7.0,
      w: 4,
      h: 0.35,
      fontSize: 8,
      color: EXECUTIVE_COLORS.darkText,
      fontFace: "Calibri",
      align: "left",
    });
    slideObj.addText(`Slide ${slideNumber} of ${totalSlides}`, {
      x: 5.5,
      y: 7.0,
      w: 4,
      h: 0.35,
      fontSize: 8,
      color: EXECUTIVE_COLORS.darkNavy,
      fontFace: "Calibri",
      align: "right",
    });
  };

  addFooter(slideObj, slide.slideNumber, totalSlides);
}

// CTA SLIDE - Call to Action (Bold closing)
function addCTASlide(prs: any, slide: any, totalSlides: number) {
  const slideObj = prs.addSlide();

  // Dark navy background
  slideObj.background = { color: EXECUTIVE_COLORS.darkNavy };

  // Gold accent bar at top
  slideObj.addShape(prs.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 10,
    h: 0.15,
    fill: { color: EXECUTIVE_COLORS.gold },
    line: { type: "none" },
  });

  // Main title
  slideObj.addText(slide.title, {
    x: 0.5,
    y: 2.2,
    w: 9,
    h: 1,
    fontSize: 48,
    bold: true,
    color: EXECUTIVE_COLORS.gold,
    align: "center",
    fontFace: "Calibri",
  });

  // Description
  if (slide.description) {
    slideObj.addText(slide.description, {
      x: 1,
      y: 3.4,
      w: 8,
      h: 1.5,
      fontSize: 18,
      color: EXECUTIVE_COLORS.white,
      align: "center",
      fontFace: "Calibri",
    });
  }

  // Content points (action items)
  let yPos = 5.2;
  slide.content.forEach((point: string) => {
    slideObj.addText(`✓ ${point}`, {
      x: 1.5,
      y: yPos,
      w: 7,
      h: 0.4,
      fontSize: 14,
      color: EXECUTIVE_COLORS.gold,
      fontFace: "Calibri",
      align: "center",
    });
    yPos += 0.5;
  });

  // Add footer
  const addFooter = (slideObj: any, slideNumber: number, totalSlides: number) => {
    slideObj.addShape(prs.ShapeType.rect, {
      x: 0,
      y: 6.9,
      w: 10,
      h: 0.05,
      fill: { color: EXECUTIVE_COLORS.gold },
      line: { type: "none" },
    });
    slideObj.addText(`© DeliveryForge`, {
      x: 0.5,
      y: 7.0,
      w: 4,
      h: 0.35,
      fontSize: 8,
      color: EXECUTIVE_COLORS.darkText,
      fontFace: "Calibri",
      align: "left",
    });
    slideObj.addText(`Slide ${slideNumber} of ${totalSlides}`, {
      x: 5.5,
      y: 7.0,
      w: 4,
      h: 0.35,
      fontSize: 8,
      color: EXECUTIVE_COLORS.gold,
      fontFace: "Calibri",
      align: "right",
    });
  };

  addFooter(slideObj, slide.slideNumber, totalSlides);
}

export async function POST(request: NextRequest) {
  try {
    console.log("🔍 [1/2] Generating Professional Executive Pitch Deck...");

    // Get auth header
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { pitchDeck, filename } = body;

    if (!pitchDeck || !filename) {
      return NextResponse.json(
        { error: "Missing pitchDeck or filename" },
        { status: 400 }
      );
    }

    console.log("🔍 [2/2] Creating professional presentation with unique slide layouts...");

    // Create presentation
    const prs = new PptxGenJS();

    // Set slide dimensions
    prs.defineLayout({ name: "LAYOUT1", width: 10, height: 7.5 });

    // Helper function to add professional footer
    const addFooter = (slideObj: any, slideNumber: number, totalSlides: number) => {
      // Gold accent line
      slideObj.addShape(prs.ShapeType.rect, {
        x: 0,
        y: 6.9,
        w: 10,
        h: 0.05,
        fill: { color: EXECUTIVE_COLORS.gold },
        line: { type: "none" },
      });

      // Footer text
      slideObj.addText(`© DeliveryForge`, {
        x: 0.5,
        y: 7.0,
        w: 4,
        h: 0.35,
        fontSize: 8,
        color: EXECUTIVE_COLORS.darkText,
        fontFace: "Calibri",
        align: "left",
      });

      slideObj.addText(`Slide ${slideNumber} of ${totalSlides}`, {
        x: 5.5,
        y: 7.0,
        w: 4,
        h: 0.35,
        fontSize: 8,
        color: EXECUTIVE_COLORS.darkNavy,
        fontFace: "Calibri",
        align: "right",
      });
    };

    // Process each slide based on type
    pitchDeck.slides.forEach((slide: any, index: number) => {
      const slideType = slide.slideType || "content";

      if (slideType === "title") {
        addTitleSlide(prs, slide, pitchDeck.slides.length);
      } else if (slideType === "roadmap") {
        addRoadmapSlide(prs, slide, pitchDeck.slides.length);
      } else if (slideType === "metrics") {
        addMetricsSlide(prs, slide, pitchDeck.slides.length);
      } else if (slideType === "cta") {
        addCTASlide(prs, slide, pitchDeck.slides.length);
      } else {
        addContentSlide(prs, slide, pitchDeck.slides.length);
      }
    });

    console.log("✅ Presentation created with", pitchDeck.slides.length, "professional slides");

    // Generate PPT buffer
    const pptBuffer = await prs.write({ outputType: "arraybuffer" }) as ArrayBuffer;

    console.log("✅ PPT file generated, size:", pptBuffer.byteLength, "bytes");

    // Return as downloadable file
    return new NextResponse(pptBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error("❌ PPT generation error:", errorMessage);
    console.error("Stack:", error instanceof Error ? error.stack : "");

    return NextResponse.json(
      {
        success: false,
        error: "Failed to download PPT",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
