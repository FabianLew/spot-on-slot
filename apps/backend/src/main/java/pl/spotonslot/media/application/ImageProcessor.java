package pl.spotonslot.media.application;

import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Arrays;
import java.util.EnumMap;
import java.util.Map;
import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import net.coobird.thumbnailator.Thumbnails;
import pl.spotonslot.media.domain.ImageType;
import pl.spotonslot.media.domain.MediaErrors;
import pl.spotonslot.media.domain.Variant;

/**
 * Turns an uploaded image into the stored WebP variants: checks the real format, refuses images with too
 * many pixels before decoding them, applies the EXIF orientation and writes pixels only, so no metadata
 * (camera, GPS) survives.
 */
public class ImageProcessor {

    private static final float WEBP_QUALITY = 0.82f;

    private final long maxPixels;

    public ImageProcessor(long maxPixels) {
        this.maxPixels = maxPixels;
    }

    /** @param width width of the largest variant, i.e. the most a client can show */
    public record Result(int width, int height, Map<Variant, byte[]> variants) {

        public byte[] variant(Variant variant) {
            return variants.get(variant);
        }
    }

    public Result process(byte[] data, ImageType declared) {
        var actual = ImageType.sniff(Arrays.copyOf(data, Math.min(data.length, 16)))
                .orElseThrow(MediaErrors.UnsupportedType::new);
        if (actual != declared) {
            throw new MediaErrors.InvalidImage();
        }
        checkPixels(data);
        var source = decode(data);
        var variants = new EnumMap<Variant, byte[]>(Variant.class);
        BufferedImage largest = source;
        for (var variant : Variant.values()) {
            var scaled = scale(source, variant.longestSide());
            variants.put(variant, writeWebp(scaled));
            if (variant == Variant.LARGE) {
                largest = scaled;
            }
        }
        return new Result(largest.getWidth(), largest.getHeight(), variants);
    }

    /** Reads only the header, so a small file declaring huge dimensions is refused without allocating it. */
    private void checkPixels(byte[] data) {
        try (var input = ImageIO.createImageInputStream(new ByteArrayInputStream(data))) {
            var readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) {
                throw new MediaErrors.InvalidImage();
            }
            var reader = readers.next();
            try {
                reader.setInput(input, true, true);
                if ((long) reader.getWidth(0) * reader.getHeight(0) > maxPixels) {
                    throw new MediaErrors.InvalidImage();
                }
            } finally {
                reader.dispose();
            }
        } catch (IOException | RuntimeException e) {
            throw e instanceof MediaErrors.InvalidImage invalid ? invalid : new MediaErrors.InvalidImage();
        }
    }

    private static BufferedImage decode(byte[] data) {
        try {
            return Thumbnails.of(new ByteArrayInputStream(data)).scale(1).useExifOrientation(true).asBufferedImage();
        } catch (IOException | RuntimeException e) {
            throw new MediaErrors.InvalidImage();
        }
    }

    private static BufferedImage scale(BufferedImage source, int longestSide) {
        double factor = Math.min(1.0, (double) longestSide / Math.max(source.getWidth(), source.getHeight()));
        if (factor == 1.0) {
            return source;
        }
        try {
            return Thumbnails.of(source).scale(factor).asBufferedImage();
        } catch (IOException e) {
            throw new MediaErrors.InvalidImage();
        }
    }

    private static byte[] writeWebp(BufferedImage image) {
        ImageWriter writer = ImageIO.getImageWritersByMIMEType("image/webp").next();
        try (var out = new ByteArrayOutputStream(); var stream = ImageIO.createImageOutputStream(out)) {
            var param = writer.getDefaultWriteParam();
            param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
            param.setCompressionType("Lossy");
            param.setCompressionQuality(WEBP_QUALITY);
            writer.setOutput(stream);
            writer.write(null, new IIOImage(rgb(image), null, null), param);
            stream.flush();
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException("WebP encoding failed", e);
        } finally {
            writer.dispose();
        }
    }

    /** The encoder takes packed RGB or ARGB; decoders hand back many other layouts (gray, indexed, CMYK). */
    private static BufferedImage rgb(BufferedImage image) {
        int type = image.getColorModel().hasAlpha() ? BufferedImage.TYPE_INT_ARGB : BufferedImage.TYPE_INT_RGB;
        if (image.getType() == type) {
            return image;
        }
        var converted = new BufferedImage(image.getWidth(), image.getHeight(), type);
        var g = converted.createGraphics();
        g.drawImage(image, 0, 0, null);
        g.dispose();
        return converted;
    }
}
