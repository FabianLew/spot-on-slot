package pl.spotonslot.media.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import pl.spotonslot.media.domain.ImageType;
import pl.spotonslot.media.domain.MediaErrors;
import pl.spotonslot.media.domain.Variant;

class ImageProcessorTest {

    private final ImageProcessor processor = new ImageProcessor(40_000_000);

    @Test
    void writesThreeWebpVariantsWithoutUpscaling() throws IOException {
        var result = processor.process(png(2400, 1200, true), ImageType.PNG);

        assertThat(result.width()).isEqualTo(1600);
        assertThat(result.height()).isEqualTo(800);
        assertThat(size(result.variant(Variant.SMALL))).containsExactly(320, 160);
        assertThat(size(result.variant(Variant.MEDIUM))).containsExactly(800, 400);
        assertThat(size(result.variant(Variant.LARGE))).containsExactly(1600, 800);
        for (var variant : Variant.values()) {
            assertThat(ImageType.sniff(result.variant(variant))).contains(ImageType.WEBP);
        }

        var small = processor.process(png(500, 250, false), ImageType.PNG);
        assertThat(size(small.variant(Variant.MEDIUM))).containsExactly(500, 250);
        assertThat(small.width()).isEqualTo(500);
    }

    @Test
    void appliesExifOrientationAndDropsMetadata() throws IOException {
        // Orientation 6: the camera held upright, pixels stored rotated; displayed portrait.
        var jpeg = withExif(jpeg(1200, 600), 6, "GPS-SECRET-52.2297N");

        var result = processor.process(jpeg, ImageType.JPEG);

        assertThat(result.width()).isEqualTo(600);
        assertThat(result.height()).isEqualTo(1200);
        for (var variant : Variant.values()) {
            var text = new String(result.variant(variant), StandardCharsets.ISO_8859_1);
            assertThat(text).doesNotContain("Exif").doesNotContain("GPS-SECRET");
        }
    }

    @Test
    void readsWebpUploads() throws IOException {
        var webp = processor.process(png(400, 400, false), ImageType.PNG).variant(Variant.LARGE);
        assertThat(processor.process(webp, ImageType.WEBP).width()).isEqualTo(400);
    }

    @Test
    void rejectsContentThatIsNotTheDeclaredImage() throws IOException {
        assertThatThrownBy(() -> processor.process("<?php echo 1; ?>".getBytes(), ImageType.JPEG))
                .isInstanceOf(MediaErrors.UnsupportedType.class);
        assertThatThrownBy(() -> processor.process(png(10, 10, false), ImageType.JPEG))
                .isInstanceOf(MediaErrors.InvalidImage.class);
        var truncated = Arrays.copyOf(jpeg(400, 400), 40);
        assertThatThrownBy(() -> processor.process(truncated, ImageType.JPEG))
                .isInstanceOf(MediaErrors.InvalidImage.class);
    }

    @Test
    void rejectsTooManyPixelsBeforeDecoding() throws IOException {
        var strict = new ImageProcessor(1_000_000);
        assertThatThrownBy(() -> strict.process(png(1001, 1000, false), ImageType.PNG))
                .isInstanceOf(MediaErrors.InvalidImage.class);
    }

    private static int[] size(byte[] image) throws IOException {
        var decoded = ImageIO.read(new ByteArrayInputStream(image));
        return new int[] {decoded.getWidth(), decoded.getHeight()};
    }

    private static byte[] png(int width, int height, boolean alpha) throws IOException {
        var image = new BufferedImage(width, height, alpha ? BufferedImage.TYPE_INT_ARGB : BufferedImage.TYPE_INT_RGB);
        var g = image.createGraphics();
        g.setColor(Color.RED);
        g.fillRect(0, 0, width / 2, height);
        g.dispose();
        var out = new ByteArrayOutputStream();
        ImageIO.write(image, "png", out);
        return out.toByteArray();
    }

    private static byte[] jpeg(int width, int height) throws IOException {
        var image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        var out = new ByteArrayOutputStream();
        ImageIO.write(image, "jpeg", out);
        return out.toByteArray();
    }

    /** Inserts an APP1 Exif segment (big-endian TIFF, IFD0 with Orientation and an ImageDescription) after SOI. */
    private static byte[] withExif(byte[] jpeg, int orientation, String description) {
        var desc = (description + "\0").getBytes(StandardCharsets.US_ASCII);
        var tiff = new ByteArrayOutputStream();
        writeBytes(tiff, 'M', 'M', 0, 42, 0, 0, 0, 8);
        writeBytes(tiff, 0, 2);
        // Orientation (0x0112), SHORT, count 1, value in the first two bytes.
        writeBytes(tiff, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, orientation, 0, 0);
        // ImageDescription (0x010E), ASCII, count n, offset to the text after the IFD.
        int offset = 8 + 2 + 2 * 12 + 4;
        writeBytes(tiff, 0x01, 0x0E, 0, 2, 0, 0, 0, desc.length, 0, 0, 0, offset);
        writeBytes(tiff, 0, 0, 0, 0);
        tiff.writeBytes(desc);
        var payload = new ByteArrayOutputStream();
        payload.writeBytes("Exif\0\0".getBytes(StandardCharsets.US_ASCII));
        payload.writeBytes(tiff.toByteArray());
        int length = payload.size() + 2;
        var out = new ByteArrayOutputStream();
        out.write(jpeg, 0, 2);
        writeBytes(out, 0xFF, 0xE1, length >> 8, length & 0xFF);
        out.writeBytes(payload.toByteArray());
        out.write(jpeg, 2, jpeg.length - 2);
        return out.toByteArray();
    }

    private static void writeBytes(ByteArrayOutputStream out, int... values) {
        for (int value : values) {
            out.write(value);
        }
    }
}
