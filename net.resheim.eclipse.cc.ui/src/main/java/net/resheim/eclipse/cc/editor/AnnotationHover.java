package net.resheim.eclipse.cc.editor;

import java.util.Iterator;

import org.eclipse.jface.text.BadLocationException;
import org.eclipse.jface.text.Position;
import org.eclipse.jface.text.source.Annotation;
import org.eclipse.jface.text.source.IAnnotationHover;
import org.eclipse.jface.text.source.IAnnotationModel;
import org.eclipse.jface.text.source.ISourceViewer;

/**
 * Returns hover information for breakpoints.
 *
 * @author Torkild Ulvøy Resheim
 * @since 1.0
 *
 *        XXX: Delete this, not required
 */
public class AnnotationHover implements IAnnotationHover {

	@Override
	public String getHoverInfo(ISourceViewer sourceViewer, int lineNumber) {
		System.out.println("AnnotationHover.getHoverInfo()");
		IAnnotationModel annotationModel = sourceViewer.getAnnotationModel();
		Iterator<Annotation> iterator = annotationModel.getAnnotationIterator();
		while (iterator.hasNext()) {
			Annotation annotation = iterator.next();
			Position position = annotationModel.getPosition(annotation);
			try {
				int lineOfAnnotation = sourceViewer.getDocument().getLineOfOffset(position.getOffset());
				if (lineNumber == lineOfAnnotation) {
					System.out.println("AnnotationHover.getHoverInfo()");
					return annotation.getText();
				}
			} catch (BadLocationException e) {
			}
		}
		return null;
	}

}
