import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import type { JSONContent } from '@tiptap/core';

export default function EditorContrato({ contenido, alCambiar, soloLectura = false }: {
  contenido: JSONContent;
  alCambiar: (doc: JSONContent) => void;
  soloLectura?: boolean;
}) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ link: false })],
    content: contenido,
    editable: !soloLectura,
    onUpdate({ editor: actual }) { alCambiar(actual.getJSON()); },
    editorProps: { attributes: { class: 'gestor-contratos__hoja', 'aria-label': 'Contenido del contrato' } },
  });
  if (!editor) return <p>Cargando editor…</p>;
  const herramientas = [
    { nombre: 'Deshacer', tecla: '↶', accion: () => editor.chain().focus().undo().run(), puede: () => editor.can().undo() },
    { nombre: 'Rehacer', tecla: '↷', accion: () => editor.chain().focus().redo().run(), puede: () => editor.can().redo() },
    { nombre: 'Negrita', tecla: 'B', accion: () => editor.chain().focus().toggleBold().run(), puede: () => editor.can().toggleBold() },
    { nombre: 'Cursiva', tecla: 'I', accion: () => editor.chain().focus().toggleItalic().run(), puede: () => editor.can().toggleItalic() },
    { nombre: 'Subrayado', tecla: 'U', accion: () => editor.chain().focus().toggleUnderline().run(), puede: () => editor.can().toggleUnderline() },
    { nombre: 'Encabezado', tecla: 'H2', accion: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), puede: () => true },
    { nombre: 'Viñetas', tecla: '•', accion: () => editor.chain().focus().toggleBulletList().run(), puede: () => true },
    { nombre: 'Lista numerada', tecla: '1.', accion: () => editor.chain().focus().toggleOrderedList().run(), puede: () => true },
  ];
  return <div className="gestor-contratos__editor">
    {!soloLectura && <div className="gestor-contratos__herramientas" role="toolbar" aria-label="Herramientas del editor">
      {herramientas.map(item => <button key={item.nombre} type="button" title={item.nombre}
        aria-label={item.nombre} disabled={!item.puede()} onClick={item.accion}>{item.tecla}</button>)}
    </div>}
    <EditorContent editor={editor}/>
  </div>;
}
