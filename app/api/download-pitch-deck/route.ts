import { NextRequest, NextResponse } from "next/server";
import PptxGenJS from "pptxgenjs";

export async function POST(request: NextRequest) {
  try {
    console.log("🔍 [1/2] Generating PPT file with pptxgenjs...");

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

    console.log("🔍 [2/2] Creating presentation...");

    // Create presentation
    const prs = new PptxGenJS();

    // Define slide dimensions and colors
    // (Layouts removed - not needed for pptxgenjs 4.0.1)

    // Define color scheme
    const colors = {
      primary: "2563EB",
      dark: "1E293B",
      light: "F1F5F9",
      accent: "7C3AED",
      white: "FFFFFF",
    };

    // Add title slide
    const titleSlide = prs.addSlide();
    titleSlide.background = { color: colors.primary };
    titleSlide.addText(pitchDeck.title, {
      x: 0.5,
      y: 2.5,
      w: 9,
      h: 1.5,
      fontSize: 54,
      bold: true,
      color: colors.white,
      align: "center",
      fontFace: "Calibri",
    });
    titleSlide.addText("Professional Pitch Deck", {
      x: 0.5,
      y: 4.2,
      w: 9,
      h: 0.5,
      fontSize: 24,
      color: colors.light,
      align: "center",
      fontFace: "Calibri",
    });

    // Add content slides
    pitchDeck.slides.forEach((slide: any, index: number) => {
      const slideObj = prs.addSlide();

      // Alternating background colors for visual interest
      const bgColor = index % 2 === 0 ? colors.white : colors.light;
      slideObj.background = { color: bgColor };

      // Slide number and title bar
      slideObj.addShape(prs.ShapeType.rect, {
        x: 0,
        y: 0,
        w: 10,
        h: 0.8,
        fill: { color: colors.primary },
      });

      slideObj.addText(`${slide.slideNumber}. ${slide.title}`, {
        x: 0.5,
        y: 0.15,
        w: 9,
        h: 0.5,
        fontSize: 32,
        bold: true,
        color: colors.white,
        fontFace: "Calibri",
      });

      // Content bullets
      let yPosition = 1.2;
      slide.content.forEach((point: string, pointIndex: number) => {
        slideObj.addText(`• ${point}`, {
          x: 0.75,
          y: yPosition,
          w: 8.5,
          h: 0.6,
          fontSize: 14,
          color: colors.dark,
          fontFace: "Calibri",
          align: "left",
        });
        yPosition += 0.7;
      });

      // Add notes if available
      if (slide.notes) {
        slideObj.addText(`Note: ${slide.notes}`, {
          x: 0.5,
          y: 6.8,
          w: 9,
          h: 0.6,
          fontSize: 10,
          color: colors.accent,
          italic: true,
          fontFace: "Calibri",
        });
      }

      // Add footer with slide count
      slideObj.addText(`© DeliveryForge | Slide ${slide.slideNumber}/${pitchDeck.slides.length}`, {
        x: 0.5,
        y: 7.0,
        w: 9,
        h: 0.3,
        fontSize: 8,
        color: colors.accent,
        align: "right",
        fontFace: "Calibri",
      });
    });

    console.log("✅ Presentation created with", pitchDeck.slides.length, "slides");

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
